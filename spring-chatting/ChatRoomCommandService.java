package kpaas.dogcat.domain.chat.service.command;
 
import kpaas.dogcat.domain.chat.service.query.ChatRoomQueryService;
import kpaas.dogcat.global.apiPayload.code.CustomException;
import kpaas.dogcat.global.apiPayload.code.ErrorCode;
import org.springframework.transaction.annotation.Transactional;
import kpaas.dogcat.domain.adopt.entity.Adopt;
import kpaas.dogcat.domain.adopt.service.AdoptQueryService;
import kpaas.dogcat.domain.chat.dto.ChatResDTO;
import kpaas.dogcat.domain.chat.entity.ChatParticipant;
import kpaas.dogcat.domain.chat.entity.ChatRoom;
import kpaas.dogcat.domain.chat.entity.RoomStatus;
import kpaas.dogcat.domain.chat.repository.ChatRoomRepository;
import kpaas.dogcat.domain.member.entity.Member;
import kpaas.dogcat.domain.member.service.AuthCommandService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
 
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
 
 
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class ChatRoomCommandService {
 
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomQueryService chatRoomQueryService;
    private final ChatParticipantCommandService chatParticipantCommandService;
    private final AuthCommandService authCommandService;
    private final AdoptQueryService adoptQueryService;
 
    public ChatResDTO.ChatRoomCreatedDTO createRoom(String initiatorId, String targetId, Long adoptId, String roomName) {
        // 사용자 & 입양 공고 검증
        Member initiator = authCommandService.findById(initiatorId);    // 입양원하는 사용자
        Member target = authCommandService.findById(targetId);          // 입양 공고 작성자
        Adopt adopt = adoptQueryService.findById(adoptId);
 
        // 중복방 체크하고 없으면 생성, 있으면 기존 채팅방 반환
        Optional<ChatRoom> existingRoom = chatRoomQueryService.findExistingRoom(initiatorId, targetId, adoptId);
        if(targetId.equals(initiator.getId())) {
            throw new CustomException(ErrorCode.CHAT_CANNOT_WITH_SELF);
        }
        if(existingRoom.isPresent()) {
            ChatRoom chatRoom = existingRoom.get();
            return new ChatResDTO.ChatRoomCreatedDTO(chatRoom.getId(), chatRoom.getRoomName());
        }
        ChatRoom chatRoom = ChatRoom.builder()
                .adopt(adopt)
                .initiatorId(initiatorId)
                .targetId(targetId)
                .roomName(adopt.getTitle())
                .roomStatus(RoomStatus.OPEN)
                .build();
        chatRoomRepository.save(chatRoom);
 
        // 두 참여자 모두 추가
        List<ChatParticipant> participants = Arrays.asList(
                ChatParticipant.builder().chatRoom(chatRoom).member(initiator).build(),
                ChatParticipant.builder().chatRoom(chatRoom).member(target).build()
        );
        chatParticipantCommandService.saveAllParticipants(participants);
 
        return new ChatResDTO.ChatRoomCreatedDTO(chatRoom.getId(), chatRoom.getRoomName());
    }
}