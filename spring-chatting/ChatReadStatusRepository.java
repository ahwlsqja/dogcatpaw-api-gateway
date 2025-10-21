package kpaas.dogcat.domain.chat.repository;
 
import kpaas.dogcat.domain.chat.entity.ChatMessage;
import kpaas.dogcat.domain.chat.entity.ChatReadStatus;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
 
import java.util.List;
 
@Repository
public interface ChatReadStatusRepository extends JpaRepository<ChatReadStatus, Long> {
 
    // 특정 메시지를, 특정 유저가 읽었는지 여부 확인하기 위한 메서드
    List<ChatReadStatus> findByChatMessageAndMember(ChatMessage message, Member member);
 
    @Modifying
    @Query("""
    UPDATE ChatReadStatus crs 
       SET crs.isRead = true 
     WHERE crs.chatRoom = :chatRoom 
       AND crs.member = :member 
       AND crs.isRead = false
""")
    int markAsRead(@Param("chatRoom") ChatRoom chatRoom, @Param("member") Member member);
 
    Long countByChatRoomAndMemberAndIsReadFalse(ChatRoom chatRoom, Member member);
}