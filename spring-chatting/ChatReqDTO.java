package kpaas.dogcat.domain.chat.dto;
 
import lombok.AllArgsConstructor;
import lombok.Data;
 
@Data
@AllArgsConstructor
public class ChatReqDTO {
 
    @Data
    @AllArgsConstructor
    public static class ChatMessageReqDTO {
        private Long roomId;
        private String chatSenderId;
        private String message;
    }
 
    @Data
    @AllArgsConstructor
    public static class ChatRoomCreateDTO {
        private String adoptWriterId;
        private Long adoptId;
        private String roomName;
    }
 
    @Data
    public static class ChatCardReqDTO {
        private Long roomId;
    }
}