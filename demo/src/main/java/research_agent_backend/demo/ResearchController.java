package research_agent_backend.demo;


import java.time.Duration;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import lombok.RequiredArgsConstructor;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/research")
@RequiredArgsConstructor
public class ResearchController {

    private final WebClient pythonAgentClient;

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> streamResearch(@RequestBody Map<String, Object> request) {
        return pythonAgentClient.post()
                .uri("/research/stream")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM) // CRITICAL: Accept SSE explicitly
                .bodyValue(request)
                .retrieve()
                .bodyToFlux(String.class)
                .timeout(Duration.ofSeconds(180)) // Prevent silent hangs (Python takes ~27s)
                .doOnNext(chunk -> System.out.println("STREAM CHUNK: " + 
                    chunk.substring(0, Math.min(50, chunk.length())))); // Debug log
    }
}