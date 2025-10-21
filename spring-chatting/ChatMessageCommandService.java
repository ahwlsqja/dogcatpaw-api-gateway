package kpaas.dogcat.domain.chat.service.command;
 
import kpaas.dogcat.domain.chat.dto.ChatReqDTO;
import kpaas.dogcat.domain.chat.dto.ChatResDTO;
import kpaas.dogcat.domain.chat.entity.ChatMessage;
import kpaas.dogcat.domain.chat.entity.ChatParticipant;
import kpaas.dogcat.domain.chat.entity.ChatReadStatus;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.chat.repository.ChatMessageRepository;
import kpaas.dogcat.domain.chat.repository.ChatReadStatusRepository;
import kpaas.dogcat.domain.chat.repository.ChatRoomRepository;
import kpaas.dogcat.domain.chat.service.query.ChatMessageQueryService;
import kpaas.dogcat.domain.chat.service.query.ChatParticipantQueryService;
import kpaas.dogcat.domain.member.entity.Member;
import kpaas.dogcat.domain.member.service.AuthCommandService;
import kpaas.dogcat.global.apiPayload.code.CustomException;
import kpaas.dogcat.global.apiPayload.code.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
 
import java.util.List;
 
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ChatMessageCommandService {
 
    private final ChatParticipantQueryService chatParticipantQueryService;
    private final AuthCommandService authCommandService;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatReadStatusRepository chatReadStatusRepository;
    private final ChatMessageQueryService chatMessageQueryService;
 
    public void saveMessage(ChatReqDTO.ChatMessageReqDTO chatMessageReqDTO) {
        //채팅방 조회
        ChatRoom chatRoom = chatRoomRepository.findById(chatMessageReqDTO.getRoomId())
                .orElseThrow(() -> new CustomException(ErrorCode.ROOM_NOTFOUND));
 
        //채팅방과 멤버 조회
        ChatParticipant sender = chatParticipantQueryService.findByMemberIdAndChatRoomId(
                chatMessageReqDTO.getChatSenderId(), chatRoom.getId());
 
        //메시지 저장
        ChatMessage chatMessage = ChatMessage.builder()
                .chatRoom(chatRoom)
                .participant(sender)
                .member(sender.getMember())
                .chatMessage(chatMessageReqDTO.getMessage())
                .build();
 
        ChatMessage savedMessage = chatMessageRepository.save(chatMessage);
 
        //모든 참여자에 대해 읽음 상태 저장
        List<ChatParticipant> participants = chatParticipantQueryService.findByChatRoomId(chatMessageReqDTO.getRoomId());
        for (ChatParticipant participant : participants) {
            ChatReadStatus readStatus = ChatReadStatus.builder()
                    .chatRoom(chatRoom)
                    .chatMessage(savedMessage)
                    .member(participant.getMember())
                    .isRead(participant.getMember().getId().equals(sender.getMember().getId()))     // 보낸 사람은 이미 읽음
                    .build();
            chatReadStatusRepository.save(readStatus);
        }
    }
 
    /** 메세지 조회 및 읽음 처리 */
    public List<ChatResDTO.ChatMessageResDTO> enterRoom(Long roomId, String memberId) {
        List<ChatResDTO.ChatMessageResDTO> chatMessages = chatMessageQueryService.getChatMessages(roomId, memberId);
        markAsReadCount(roomId, memberId);
        return chatMessages;
    }
 
    /** 읽음 처리 **/
    public void markAsReadCount(Long roomId, String memberId) {
        ChatRoom chatRoom = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.ROOM_NOTFOUND));
        Member member = authCommandService.findById(memberId);
        int updatedCount = chatReadStatusRepository.markAsRead(chatRoom, member);
        log.info("[ 읽은 메세지 수 ] : {}", updatedCount);
    }
}