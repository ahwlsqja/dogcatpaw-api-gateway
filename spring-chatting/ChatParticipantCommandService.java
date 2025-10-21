package kpaas.dogcat.domain.chat.service.command;
 
import kpaas.dogcat.domain.chat.entity.ChatParticipant;
import kpaas.dogcat.domain.chat.repository.ChatParticipantRepository;
import kpaas.dogcat.domain.chat.service.query.ChatParticipantQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
 
import java.util.List;
 
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ChatParticipantCommandService {
 
    private final ChatParticipantRepository chatParticipantRepository;
    private final ChatParticipantQueryService chatParticipantQueryService;
 
    public void saveAllParticipants(List<ChatParticipant> chatParticipants) {
        for (ChatParticipant participant : chatParticipants) {
            boolean exists = chatParticipantQueryService.isRoomParticipant(
                    participant.getMember().getId(), participant.getChatRoom().getId());
            if (!exists) {
                chatParticipantRepository.save(participant);
            }
        }
    }
}