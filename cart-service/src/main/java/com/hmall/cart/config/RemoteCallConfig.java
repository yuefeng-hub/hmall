package com.hmall.cart.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * 默认（本地单机）模式：RestTemplate 直连配置好的 ip:port。
 * 叠加 nacos profile 时，NacosRemoteCallConfig 会注册一个带 @LoadBalanced 的版本并优先注入。
 */
@Configuration
public class RemoteCallConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(3))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
    }
}
