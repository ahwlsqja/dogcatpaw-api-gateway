package kpaas.dogcat.domain.chat.service.query;
 
import kpaas.dogcat.domain.chat.dto.ChatResDTO;
import kpaas.dogcat.domain.chat.entity.ChatMessage;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.chat.repository.ChatRoomRepository;
import kpaas.dogcat.domain.member.entity.Member;
import kpaas.dogcat.domain.member.service.AuthCommandService;
import kpaas.dogcat.global.apiPayload.code.CustomException;
import kpaas.dogcat.global.apiPayload.code.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
 
import java.util.List;
import java.util.Optional;
 
@Slf4j
@Service
@Transactional(readOnly=true)
@RequiredArgsConstructor
public class ChatRoomQueryService {
 
    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageQueryService chatMessageQueryService;
    private final ChatParticipantQueryService chatParticipantQueryService;
    private final AuthCommandService authCommandService;
 
    /** 중복 채팅방 방지 (같은 공고 + 같은 두 유저면 하나만 생성) **/
    public Optional<ChatRoom> findExistingRoom(String initiatorId, String targetId, Long adoptId) {
        return chatRoomRepository.findExistingRoom(initiatorId, targetId, adoptId);
    }
 
    public ChatRoom getChatRoom(Long roomId) {
        ChatRoom chatroom = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.ROOM_NOTFOUND));
        return chatroom;
    }
 
    // 개별 채팅방 카드 (이름, 메세지, 미읽음 수) 조회 -> 알림 보낼때 재활용할 생각
    public ChatResDTO.ChatRoomCardDTO getChatRoomCard(Long roomId, String memberId) {
        ChatRoom chatRoom = getChatRoom(roomId);
 
        Member loginMember = authCommandService.findById(memberId);
        Member targetMember = chatParticipantQueryService.getTargetMember(chatRoom, loginMember);
        Long unreadCount = chatMessageQueryService.getUnreadCount(chatRoom, loginMember);
        ChatMessage latestMessage = chatMessageQueryService.getLatestMessage(chatRoom);
 
        return new ChatResDTO.ChatRoomCardDTO(
                chatRoom.getId(),
                chatRoom.getRoomName(),
                targetMember.getNickname(),
                latestMessage.getChatMessage(),
                unreadCount);
    }
 
 
    // 채팅방 카드 리스트(이름, 메세지, 미읽음 수) 조회
    public List<ChatResDTO.ChatRoomCardDTO> getChatRoomCards(String memberId) {
        List<ChatRoom> rooms = chatRoomRepository.findRoomIdsByMemberId(memberId);
 
        return rooms.stream()
                .map(room -> getChatRoomCard(room.getId(), memberId))  // 개별 메서드 재사용
                .toList();
    }
}