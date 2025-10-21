package kpaas.dogcat.domain.chat.repository;
 
 
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
 
 
import java.util.List;
import java.util.Optional;
 
@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
//    Optional<ChatRoom> findById(Long roomId);
 
    @Query("""
    SELECT r FROM ChatRoom r
    WHERE r.adopt.id = :adoptId
    AND (
        (r.initiatorId = :initiatorId AND r.targetId = :targetId)
        OR (r.initiatorId = :targetId AND r.targetId = :initiatorId)
    )
""")
    Optional<ChatRoom> findExistingRoom(
            @Param("initiatorId") String initiatorId,
            @Param("targetId") String targetId,
            @Param("adoptId") Long adoptId
    );
 
    @Query("""
    SELECT cr FROM ChatRoom cr 
    JOIN cr.participants p
    WHERE p.member.id = :memberId
    """)
    List<ChatRoom> findRoomIdsByMemberId(String memberId);
}