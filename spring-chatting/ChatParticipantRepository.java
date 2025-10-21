package kpaas.dogcat.domain.chat.repository;
 
import kpaas.dogcat.domain.chat.entity.ChatParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.member.entity.Member;
 
import java.util.List;
import java.util.Optional;
 
@Repository
public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {
    List<ChatParticipant> findByChatRoomId(Long roomId);
    List<ChatParticipant> findByMemberAndChatRoom(Member member, ChatRoom chatRoom);
    Optional<ChatParticipant> findByMemberIdAndChatRoomId(String memberId, Long roomId);
    boolean existsByChatRoomIdAndMemberId(Long roomId, String memberId);
}