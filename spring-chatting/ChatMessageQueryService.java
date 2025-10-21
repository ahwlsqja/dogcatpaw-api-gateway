package kpaas.dogcat.domain.chat.service.query;
 
import kpaas.dogcat.domain.adopt.dto.AdoptResDto;
import kpaas.dogcat.domain.adopt.entity.Adopt;
import kpaas.dogcat.domain.adopt.service.AdoptQueryService;
import kpaas.dogcat.domain.chat.dto.ChatResDTO;
import kpaas.dogcat.domain.chat.entity.ChatMessage;
import kpaas.dogcat.domain.chat.entity.ChatParticipant;
import kpaas.dogcat.domain.chat.entity.ChatReadStatus;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.chat.repository.ChatMessageRepository;
import kpaas.dogcat.domain.chat.repository.ChatReadStatusRepository;
import kpaas.dogcat.domain.chat.repository.ChatRoomRepository;
import kpaas.dogcat.domain.member.entity.Member;
import kpaas.dogcat.domain.member.service.AuthCommandService;
import kpaas.dogcat.domain.pet.dto.PetResDto;
import kpaas.dogcat.global.apiPayload.code.CustomException;
import kpaas.dogcat.global.apiPayload.code.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
 
import java.util.ArrayList;
import java.util.List;
 
@Slf4j
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ChatMessageQueryService {
 
    private final ChatParticipantQueryService chatParticipantQueryService;
    private final AuthCommandService authCommandService;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatReadStatusRepository chatReadStatusRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final AdoptQueryService adoptQueryService;
 
    /** 가장 최근 메시지 */
    public ChatMessage getLatestMessage(ChatRoom room) {
        return chatMessageRepository.findTop1ByChatRoomOrderByIdDesc(room)
                .orElseThrow(() -> new CustomException(ErrorCode.MESSAGE_NOTFOUND));
    }
 
    /** 안 읽은 메시지 수 */
    public Long getUnreadCount(ChatRoom room, Member member) {
        return chatReadStatusRepository.countByChatRoomAndMemberAndIsReadFalse(room, member);
    }
 
    /** 메시지 리스트 조회 */
    public List<ChatResDTO.ChatMessageResDTO> getChatMessages(Long roomId, String memberId) {
        ChatRoom chatRoom = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.ROOM_NOTFOUND));
 
        // 로그인된 사용자가 참여자가 맞는지 확인
        Member me = authCommandService.findById(memberId);
        chatParticipantQueryService.findByMemberIdAndChatRoomId(memberId, roomId);
 
        // 상대방 찾기
        List<ChatParticipant> participants = chatParticipantQueryService.findByChatRoomId(roomId);
        Member opponent = participants.stream()
                .map(ChatParticipant::getMember)
                .filter(m -> !m.getId().equals(memberId))
                .findFirst()
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOTFOUND));
 
        // 전체 메시지 조회
        List<ChatMessage> chatMessages = chatMessageRepository.findAllByRoomIdWithMember(roomId);
        List<ChatResDTO.ChatMessageResDTO> result = new ArrayList<>();
 
        for (ChatMessage msg : chatMessages) {
            boolean isRead;
 
            if (msg.getMember().getId().equals(me.getId())) {
                // 내가 보낸 메시지 → 상대방이 읽었는지 확인
                List<ChatReadStatus> opponentStatus = chatReadStatusRepository.findByChatMessageAndMember(msg, opponent);
                isRead = !opponentStatus.isEmpty() && opponentStatus.get(0).isRead();
            } else {
                // 상대방이 보낸 메시지 → 나는 이미 읽은 상태
                isRead = true;
            }
 
            result.add(ChatResDTO.ChatMessageResDTO.builder()
                    .messageId(msg.getId())
                    .senderId(msg.getMember().getId())
                    .senderName(msg.getMember().getNickname())
                    .message(msg.getChatMessage())
                    .isRead(isRead)
                    .adoptId(chatRoom.getAdopt().getId())
                    .build());
        }
        return result;
    }
 
    /** 채팅방 상단에 입양 공고 조회*/
    public PetResDto.PetChatDto getAdoptInfo(Long roomId) {
        ChatRoom chatRoom = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.ROOM_NOTFOUND));
 
        Adopt adopt = chatRoom.getAdopt();
        if (adopt == null) {
            throw new CustomException(ErrorCode.ADOPTION_NOTFOUND);
        }
        return adoptQueryService.getAdoptionForChatting(adopt);
    }
}