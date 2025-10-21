package kpaas.dogcat.domain.chat.entity;
 
import jakarta.persistence.*;
import kpaas.dogcat.domain.member.entity.Member;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.springframework.data.annotation.CreatedDate;
 
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
 
@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {
 
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
 
    @Column(nullable = false)
    private String chatMessage;
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_id")
    private ChatParticipant participant;
 
    @ManyToOne(fetch = FetchType.LAZY) // 메시지 보낸 회원
    @JoinColumn(name = "member_id")
    private Member member;
 
    @ManyToOne(fetch = FetchType.LAZY) // 메시지가 속한 채팅방
    @JoinColumn(name = "room_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ChatRoom chatRoom;
 
    @OneToMany(mappedBy = "chatMessage", cascade = CascadeType.ALL)
    private List<ChatReadStatus> chatReadStatuses = new ArrayList<>();
 
    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
 
}