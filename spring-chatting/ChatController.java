package kpaas.dogcat.domain.chat.controller;
 
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import kpaas.dogcat.domain.adopt.dto.AdoptResDto;
import kpaas.dogcat.domain.chat.dto.ChatReqDTO;
import kpaas.dogcat.domain.chat.dto.ChatResDTO;
import kpaas.dogcat.domain.chat.service.command.ChatMessageCommandService;
import kpaas.dogcat.domain.chat.service.query.ChatMessageQueryService;
import kpaas.dogcat.domain.chat.service.command.ChatRoomCommandService;
import kpaas.dogcat.domain.chat.service.query.ChatRoomQueryService;
import kpaas.dogcat.domain.pet.dto.PetResDto;
import kpaas.dogcat.global.apiPayload.CustomResponse;
import kpaas.dogcat.global.apiPayload.code.SuccessCode;
import kpaas.dogcat.global.auth.CurrentWalletAddress;
import kpaas.dogcat.global.jwt.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
 
import java.util.List;
 
@RestController
@RequiredArgsConstructor
@Slf4j
@Tag(name = "채팅 관련 API")
@RequestMapping("/api/chat")
public class ChatController {
 
    private final ChatRoomCommandService chatRoomCommandService;
    private final ChatRoomQueryService chatRoomQueryService;
    private final ChatMessageQueryService chatMessageQueryService;
    private final ChatMessageCommandService chatMessageCommandService;
 
    @Operation(summary = "채팅방 생성하기", description = "adoptWriterId에 입양공고를 작성한 사람을 넣어주고, 입양 공고 번호를 넣어주세요." +
            "방 이름 설정이 가능하니 일단은 입양 공고 이름으로 방 생성하세요.")
    @PostMapping("/room/create")
    public CustomResponse<ChatResDTO.ChatRoomCreatedDTO> createRoom(@RequestBody ChatReqDTO.ChatRoomCreateDTO dto,
                                                                    @Parameter(hidden = true) @CurrentWalletAddress String walletAddress) {
        ChatResDTO.ChatRoomCreatedDTO room = chatRoomCommandService.createRoom(
                walletAddress, dto.getAdoptWriterId(), dto.getAdoptId(), dto.getRoomName());
        return CustomResponse.onSuccess(SuccessCode.CREATED, room);
    }
 
    @Operation(summary = "채팅방 입장 및 메시지 조회하기", description = "채팅방 입장 및 메세지 조회하기")
    @PostMapping("/{roomId}/enter")
    public CustomResponse<List<ChatResDTO.ChatMessageResDTO>> enterRoom(@PathVariable Long roomId,
                                                                        @Parameter(hidden = true) @CurrentWalletAddress String walletAddress) {
        List<ChatResDTO.ChatMessageResDTO> chatMessageList = chatMessageCommandService.enterRoom(roomId, walletAddress);
        return CustomResponse.onSuccess(SuccessCode.OK, chatMessageList);
    }
 
    @Operation(summary = "채팅방 카드 단일 조회", description = "채팅방 카드 단일 조회하기 ")
    @GetMapping("/room/card")
    public CustomResponse<ChatResDTO.ChatRoomCardDTO> getRoomCard(@RequestParam Long roomId,
                                                                  @Parameter(hidden = true) @CurrentWalletAddress String walletAddress) {
        ChatResDTO.ChatRoomCardDTO chatRoom = chatRoomQueryService.getChatRoomCard(roomId, walletAddress);
        return CustomResponse.onSuccess(SuccessCode.OK, chatRoom);
    }
 
    @Operation(summary = "채팅방 목록 조회", description = "채팅방 전체 목록 조회하기 ")
    @GetMapping("/room/list")
    public CustomResponse<List<ChatResDTO.ChatRoomCardDTO>> getRoomCardList(@Parameter(hidden = true) @CurrentWalletAddress String walletAddress) {
        List<ChatResDTO.ChatRoomCardDTO> chatRooms = chatRoomQueryService.getChatRoomCards(walletAddress);
        return CustomResponse.onSuccess(SuccessCode.OK, chatRooms);
    }
 
    @Operation(summary = "채팅방 상단 입양 공고 조회", description = "해당되는 입양 공고를 채팅방 상단에 띄우는 API입니다.")
    @GetMapping("/room/{roomId}/adoption")
    public CustomResponse<PetResDto.PetChatDto> getAdoptInfoForChat(@PathVariable Long roomId) {
        PetResDto.PetChatDto adoptInfo = chatMessageQueryService.getAdoptInfo(roomId);
        return CustomResponse.onSuccess(SuccessCode.OK, adoptInfo);
    }
}