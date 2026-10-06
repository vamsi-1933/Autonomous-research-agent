package research_agent_backend.demo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class webconfig {

    @Value("${python.agent.url:http://localhost:8000}")
    private String pythonAgentUrl;

    @Bean 
    public WebClient pythonAgentClient(){
        return WebClient.builder()
        .baseUrl(pythonAgentUrl)
        .build();
    }
    
}
