package kpaas.dogcat.domain.chat.service.query;
 
import kpaas.dogcat.domain.chat.entity.ChatParticipant;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.chat.repository.ChatParticipantRepository;
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
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ChatParticipantQueryService {
 
    private final ChatParticipantRepository chatParticipantRepository;
    private final AuthCommandService authCommandService;
 
    // 참여자인지 검증
    public boolean isRoomParticipant(String memberId, Long roomId) {
        Member member = authCommandService.findById(memberId);
        return chatParticipantRepository.existsByChatRoomIdAndMemberId(roomId, member.getId());
    }
 
    // 참여자 2명 중에서 나를 제외한 한명 (상대방)
    public Member getTargetMember(ChatRoom room, Member loginMember) {
        return room.getParticipants().stream()
                .map(ChatParticipant::getMember)
                .filter(member -> !member.getId().equals(loginMember.getId()))
                .findFirst()
                .orElseThrow(() -> new CustomException(ErrorCode.PARTICIPANT_NOTFOUND));
    }
 
    public ChatParticipant findByMemberIdAndChatRoomId(String memberId, Long roomId) {
        ChatParticipant participant = chatParticipantRepository.findByMemberIdAndChatRoomId(memberId, roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.PARTICIPANT_NOTFOUND));
        return participant;
    }
 
    public List<ChatParticipant> findByChatRoomId(Long roomId) {
        return chatParticipantRepository.findByChatRoomId(roomId);
    }
}