package kpaas.dogcat.domain.chat.service;
 
import kpaas.dogcat.domain.chat.service.query.ChatParticipantQueryService;
import kpaas.dogcat.domain.member.entity.Member;
import kpaas.dogcat.domain.member.service.AuthCommandService;
import kpaas.dogcat.global.apiPayload.code.CustomException;
import kpaas.dogcat.global.apiPayload.code.ErrorCode;
//import kpaas.dogcat.global.jwt.JwtVerifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Service;
 
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatEntryService {
 
//    private final JwtVerifier jwtVerifier;
    private final AuthCommandService authCommandService;
    private final ChatParticipantQueryService chatParticipantQueryService;
 
    /**
     * STOMP CONNECT 시 인증 처리
     */
//    public void connectSocket(StompHeaderAccessor accessor) {
//        String accessToken = extractAccessToken(accessor);
//
//        // JWT 유효성 검증
//        if (!jwtVerifier.isValid(accessToken) || jwtVerifier.isExpired(accessToken)) {
//            throw new CustomException(ErrorCode.INVALID_TOKEN);
//        }
//
//        String walletAddress = jwtVerifier.getWalletAddress(accessToken);
//        log.info("[ STOMP CONNECT - 사용자: {} ]", walletAddress);
//
//        accessor.getSessionAttributes().put("memberId", walletAddress); // 세션 저장
//        Member member = authCommandService.findById(walletAddress);
//        accessor.getSessionAttributes().put("nickName", member.getNickname());
//        accessor.setUser(() -> walletAddress);  // Principal 생성
//    }
 
    public void subscribeSocket(StompHeaderAccessor accessor) {
        log.info("[ STOMP SUBSCRIBE - 방 참여 권한 검증 ]");
        String destination = accessor.getDestination();
 
        if (destination != null && destination.startsWith("/topic/")) {
 
            // destination에서 roomId 추출: /topic/{roomId}
            String[] parts = destination.split("/");
            Long roomId = Long.parseLong(parts[2]);
            String nickName = (String) accessor.getSessionAttributes().get("nickName");
            String memberId = (String) accessor.getSessionAttributes().get("memberId");
 
            if (!chatParticipantQueryService.isRoomParticipant(memberId, roomId)) {
                log.error("[ 방 {} 참여 권한 없음 - 사용자: {} ]", roomId, nickName);
                throw new CustomException(ErrorCode.ROOM_NO_AUTH);
            }
            log.info("[ 방 {} 구독 성공 - 사용자: {} ]", roomId, nickName);
        }
    }
 
//    private String extractAccessToken(StompHeaderAccessor accessor) {
//        String bearerToken = accessor.getFirstNativeHeader("Authorization");
//        if (bearerToken == null || !jwtVerifier.isValid(bearerToken.substring(7))) {
//            throw new CustomException(ErrorCode.INVALID_TOKEN);
//        }
//        return bearerToken.substring(7);
//    }
}
 