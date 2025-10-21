package kpaas.dogcat.global.stomp;
 
import kpaas.dogcat.domain.chat.dto.ChatReqDTO;
import kpaas.dogcat.domain.chat.service.command.ChatMessageCommandService;
import kpaas.dogcat.global.redis.service.RedisPubSubService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
 
@Slf4j
@Controller
@RequiredArgsConstructor
public class StompController {
 
    private final ChatMessageCommandService chatMessageCommandService;
    private final RedisPubSubService redisPubSubService;
 
    // 방법2. MessageMapping만 활용 - 현재 이거 활용
    @MessageMapping("/room/{roomId}")
    public void sendMessage2(@DestinationVariable Long roomId, ChatReqDTO.ChatMessageReqDTO chatMessageReqDTO){
        log.info("[ sendMessage : {} ]", chatMessageReqDTO.getMessage());
        chatMessageCommandService.saveMessage(chatMessageReqDTO);
        // 레디스 chat 채널로 해당 메세지 발행하면
        // 메세지리스너어댑터가 메세지를 수신하여 펍섭서비스의 onMessage()을 호출
        redisPubSubService.publish("chat", chatMessageReqDTO);
    }
 
}