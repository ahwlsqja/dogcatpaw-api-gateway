수정
삭제
코드비교

package kpaas.dogcat.domain.chat.repository;
 
import jakarta.transaction.Transactional;
import kpaas.dogcat.domain.chat.entity.ChatMessage;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
 
 
import java.util.List;
import java.util.Optional;
 
@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    Optional<ChatMessage> findTop1ByChatRoomOrderByIdDesc(ChatRoom chatRoom);
    //기존 JPA에서 FETCH JOIN 변경
    @Query("SELECT m FROM ChatMessage m JOIN FETCH m.member WHERE m.chatRoom.id = :roomId ORDER BY m.createdAt ASC")
    List<ChatMessage> findAllByRoomIdWithMember(@Param("roomId") Long roomId);
}