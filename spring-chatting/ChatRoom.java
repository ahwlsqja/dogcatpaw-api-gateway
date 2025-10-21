package kpaas.dogcat.domain.chat.entity;
 
import jakarta.persistence.*;
import kpaas.dogcat.domain.adopt.entity.Adopt;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
 
import java.util.ArrayList;
import java.util.List;
 
@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRoom {
 
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
 
    @Column(nullable = false)
    private String roomName;
 
    @Enumerated(EnumType.STRING)
    private RoomStatus roomStatus;
 
    @Column(nullable = false)
    private String initiatorId;  // 채팅 시작자 (입양자)
 
    @Column(nullable = false)
    private String targetId;     // 상대방 (입양 공고 작성자)
 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "adopt_id")
    private Adopt adopt;
 
    @OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ChatParticipant> participants = new ArrayList<>();
 
    @OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ChatMessage> chatMessages = new ArrayList<>();
 
    @OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ChatReadStatus> chatReadStatuses = new ArrayList<>();
 
//    // 채팅방 참여자 추가 (연관관계 편의 메서드)
//    public void addParticipant(ChatParticipant participant) {
//        participants.add(participant);
//        if (participant.getChatRoom() != this) {
//            participant.setChatRoom(this);
//        }
//    }
}