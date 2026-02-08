package com.translator.dto;

import lombok.Data;

import java.util.List;

/**
 * OpenAI Chat Completion API 响应格式
 * 
 * @author mac
 */
@Data
public class ChatCompletionResponse {

    private String id;
    private String model;
    private String object;
    private Long created;
    private List<Choice> choices;

    @Data
    public static class Choice {
        private Integer index;
        private Message message;
        private String finishReason;

        @Data
        public static class Message {
            private String role;
            private String content;
        }
    }
}
