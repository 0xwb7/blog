---
title: "Spring Security - 2"
description: "Spring Security를 더 깊게 이해하기 위해 공부한 글입니다."
pubDate: 2026-10-13
category: Java
tags:
  - Spring
  - Spring Security
  - JWT
draft: false
---

# Spring Security 내부 구조

이제 Spring Security가 실제로 어떻게 동작하는지 살펴보겠다.

이 부분을 제대로 이해하면 `SecurityConfig`의 각 설정의 목적을 이해하고 직접 구성할 수 있을 것이다.

## 6. Spring Security의 핵심은 Servlet Filter이다.

Spring MVC 애플리케이션에서 HTTP 요청은 일반적으로 다음 흐름으로 처리된다.

### Spring Security를 적용하지 않은 경우

```
Client
   |
   |  HTTP Request
   v
Servlet Container (Tomcat)
   |
   v
DispatcherServlet
   |
   v
HandlerMapping
   |
   |  요청을 처리할 Controller 탐색
   v
Controller
   |
   v
Service
   |
   v
Repository
   |
   v
Database
```

처리 결과는 일반적으로 반대 방향으로 반환되어, `DispatcherServlet` 을 거쳐 클라이언트에 HTTP 응답이 전달된다.

### Spring Security를 적용한 경우

```
Client
   |
   | HTTP Request
   v
Servlet Container (Tomcat)
   |
   v
DelegatingFilterProxy
   |
   v
FilterChainProxy
   |
   v
SecurityFilterChain
   |
   | 인증(Authentication)
   | 인가(Authorization)
   | 기타 보안 처리
   v
DispatcherServlet
   |
   v
HandlerMapping
   |
   v
Controller
   |
   v
Service
   |
   v
Repository
   |
   v
Database
```

핵심 차이점은 `DispatcherServlet`에 도달하기 전에 Spring Security가 요청을 검사한다는 것이다.

인증이나 인가에 실패하면 보안 필터 체인에서 요청 처리가 중단될 수 있고, 이 경우엔 Controller까지 요청이 가지 않는다.

여기서 중요한 것이 Servlet Filter이다.

### 6.1 Filter란

Filter는 Servlet에 요청이 전달되기 전이나, Servlet에서 응답을 반환한 이후에 작업을 수행할 수 있는 컴포넌트이다.

간단한 예시 코드를 보겠다.

```java
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;

import java.io.IOException;

public class LoggingFilter implements Filter {

    @Override
    public void doFilter(
            ServletRequest request,
            ServletResponse response,
            FilterChain chain
    ) throws IOException, ServletException {

        System.out.println("요청 처리 전");

        chain.doFilter(request, response);

        System.out.println("요청 처리 후");
    }
}
```

이 코드에서 가장 중요한 부분은 아래와 같다.

```java
chain.doFilter(request, response);
```

이 메서드는 요청과 응답을 다음 Filter 또는 최종 Servlet으로 전달한다.

예를 들어 Filter A와 Filter B가 등록되어 있다면 아래와 같이 동작한다.

```
HTTP Request
    |
    v
Filter A
    |     "A 요청 처리 전"
    v
Filter B
    |     "B 요청 처리 전"
    v
DispatcherServlet
    |
    v
Controller
    |
    |     Controller 처리 완료
    v
Filter B
    |     "B 요청 처리 후"
    v
Filter A
    |     "A 요청 처리 후"
    v
HTTP Response
```

따라서 콘솔에는 `A전 → B전 → B후 → A후` 순서로 출력된다.

여기서 중요한 점은 `chain.doFilter()`를 호출하지 않으면 요청이 다음 단계로 전달되지 않는다는 것이다.

예를 들어 인증에 실패한 요청은 아래와 같이 차단할 수 있다.

```java
if (authenticationFailed) {
    response.setStatus(401);
    return;
}

chain.doFilter(request, response);
```

### 6.2 Filter와 Interceptor

Spring MVC에서는 `HandlerInterceptor` 도 사용할 수 있다.

둘의 차이는 아래와 같다.

| 구분 | Filter | Interceptor |
| --- | --- | --- |
| 기반 | Servlet | Spring MVC |
| 동작 위치 | DispatcherServlet 전후 | Handler 호출 전후 |
| 대표 메서드 | `doFilter()` | `preHandle()`, `postHandle()` |
| 활용 | 보안, CORS, 요청 처리 | MVC 관련 공통 처리 |
| Spring Security | 주로 Filter 기반 | 주요 보안 체인의 기반은 아님 |

Spring Security가 Filter를 활용하는 이유는 Controller까지 요청이 도달하기 전에 인증과 접근 제어를 수행할 수 있기 때문이다.

다만 Filter만 사용한다고 해서 모든 보안 문제가 해결되는 건 아니다.

권한 검사는 서비스 계층에서도 수행을 해줘야한다.

---

## 7. Spring Security Filter Chain

Spring Security는 여러 개의 Servlet Filter를 사용하여 인증/인가 및 다양한 보안 처리를 수행한다.

전체적인 흐름은 아래와 같다.

```
Client
  |
  | HTTP Request
  v
Servlet Container (Tomcat)
  |
  v
DelegatingFilterProxy
  |
  v
FilterChainProxy
  |
  | 요청에 적합한 SecurityFilterChain 선택
  v
SecurityFilterChain
  |
  | SecurityContext 관련 필터
  |
  | CORS / CSRF 등 보안 처리
  |
  | 인증 필터
  | (예: BearerTokenAuthenticationFilter)
  |
  | AnonymousAuthenticationFilter
  |
  | ExceptionTranslationFilter
  |
  | AuthorizationFilter
  v
DispatcherServlet
  |
  v
Controller
  |
  v
Service
  |
  v
Repository
  |
  v
Database
```

이 과정에서 핵심적인 역할을 하는 구성요소는 `DelegatingFilterProxy`, `FilterChainProxy`, `SecurityFilterChain`이다.

위 구조는 이해를 위해 대표적인 필터만 표시한 거고, 실제 구성은 매번 달라질 수 있다.

### 7.1 DelegatingFilterProxy

`DelegatingFilterProxy`는 Servlet Container와 Spring이 관리하는 Filter Bean을 연결하는 역할을 한다.

앞서 봤듯이 Filter는 Servlet의 기능이다.

따라서 일반적인 Servlet Filter는 Tomcat과 같은 Servlet Container에서 관리하는 반면

Spring Security에서 사용하는 필터는 Spring의 ApplicationContext와 연동되어야 하는데

1. Servlet Container는 Spring Bean을 직접 관리하지 않는다는 점과
2. Spring Security는 Spring이 관리하는 Bean과 의존성 주입 기능을 활용한다는 점에서

문제가 발생한다.

이 둘을 연결하기 위해 사용하는 것이 바로 `DelegatingFilterProxy`이다.

```
Servlet Container
       |
       v
DelegatingFilterProxy
       |
       | Spring Bean에 요청 위임
       v
FilterChainProxy
       |
       v
Spring Security Filter 처리
```

`DelegatingFilterProxy`가 직접 인증이나 인가를 수행하는 건 아니고

Servlet Container로부터 전달받은 요청을 Spring이 관리하는 필터에 위임을 해준다.

일반적으로 Spring Security에서 위임받는 대상은 `springSecurityFilterChain`이라는 이름의 `FilterChainProxy` Bean이다.

### 7.2 FilterChainProxy

`FilterChainProxy`는 Spring Security의 여러 SecurityFilterChain을 관리하고,

HTTP 요청에 적용할 필터 체인을 선택하는 역할을 한다.

Spring Security에서는 하나의 애플리케이션에 여러 개의 SecurityFilterChain을 등록할 수 있다.

예를 들어 아래와 같이 서로 다른 보안 정책을 적용하고 싶다고 가정해보자.

```
/api/**   : JWT 기반 인증
/admin/** : 관리자용 보안 설정
/web/**   : 세션 기반 인증
```

이때 모든 요청에 동일한 필터 체인을 적용하는 대신, 요청 경로에 따라 다른 필터 체인을 적용할 수 있다.

```
HTTP Request
      |
      v
FilterChainProxy
      |
      | 요청 경로 및 Matcher 검사
      |
      +-- SecurityFilterChain A
      |      /api/**
      |
      +-- SecurityFilterChain B
      |      /admin/**
      |
      +-- SecurityFilterChain C
             /web/**
```

여기서 중요한 점은, 모든 `SecurityFilterChain`을 차례대로 실행하는 것이 아니라는 것이다.

FilterChainProxy는 우선순위에 따라 검사하여 요청에 처음 매칭되는 SecurityFilterChain 하나를 선택한다.

예를 들어 `/api/users` 요청이 들어오면 `/api/**`에 해당하는 필터 체인을 적용할 수 있는데,

여러 체인의 조건이 겹친다면 `@Order`를 통해 정의한 우선순위가 중요해진다.

또한 어떤 SecurityFilterChain에도 매칭되지 않는 요청은 Spring Security의 보호를 받지 않을 수 있기 때문에 주의해야 한다.

### 7.3 SecurityFilterChain

`SecurityFilterChain`은 HTTP 요청에 실제로 적용할 Spring Security Filter들의 집합이다.

개발자는 `HttpSecurity`를 이용하여 인증/인가 정책을 구성하고

이를 통해 `SecurityFilterChain`을 생성할 수 있다.

예시 코드를 보겠다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http.authorizeHttpRequests(auth -> auth
            .requestMatchers("/public/**").permitAll()
            .requestMatchers("/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
        );

        return http.build();
    }
}
```

- HttpSecurity
    
    HTTP 요청에 적용할 보안 정책을 구성하는 빌더이다.
    
    인증 방식, 인가 규칙, 세션 정책, CSRF 방어 등 다양한 보안 설정을 할 수 있다.
    
- authorizeHttpRequests()
    
    HTTP 요청에 대한 인가 규칙을 설정한다.
    
- requestMatchers()
    
    인가 규칙을 적용할 요청을 지정한다.
    
- permitAll()
    
    해당 요청의 접근을 허용한다.
    
    인증 여부와 관계없이 접근할 수 있도록 허용하는 인가 설정이다.
    
    단, 인증 필터 자체를 건너뛰게 하는 건 아니다.
    
- hasRole()
    
    특정 역할을 가진 사용자만 접근할 수 있도록 한다.
    
- .authenticated()
    
    인증된 사용자만 접근할 수 있도록 설정한다.
    
- build()
    
    설정한 보안 정책을 바탕으로 SecurityFilterChain을 생성한다.
    

### 7.4 여러 개의 SecurityFilterChain

아래는 예시 코드이다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    @Order(1)
    public SecurityFilterChain apiSecurity(
            HttpSecurity http
    ) throws Exception {

        http
            .securityMatcher("/api/**")
            .authorizeHttpRequests(auth -> auth
                .anyRequest().authenticated()
            );

        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain defaultSecurity(
            HttpSecurity http
    ) throws Exception {

        http
            .authorizeHttpRequests(auth -> auth
                .anyRequest().denyAll()
            );

        return http.build();
    }
}
```

- `securityMatcher()`: 해당 SecurityFilterChain을 어떤 요청에 적용할지 결정한다.
- `requestMatchers()`: 선택된 SecurityFilterChain 내부에서 어떤 인가 규칙을 적용할지 결정한다.

아래는 요청 처리 예시이다.

```
/api/users 요청이 들어온 경우

GET /api/users
       |
       v
FilterChainProxy
       |
       v
@Order(1) 확인
       |
       | /api/** 매칭 성공
       v
apiSecurity 적용
       |
       v
인증 및 인가 검사
       |
       v
DispatcherServlet

/other 요청이 들어온 경우

GET /other
       |
       v
FilterChainProxy
       |
       v
@Order(1) 확인
       |
       | /api/** 매칭 실패
       v
@Order(2) 확인
       |
       | 기본 체인 매칭 성공
       v
defaultSecurity 적용
       |
       | denyAll()
       v
접근 거부
```

따라서 여러 필터 체인을 구성할 때는 우선순위와 요청 매칭 조건을 함께 고려해야 한다.

### 7.5 실제 JWT 인증 요청의 흐름

지금까지 설명한 구조를 JWT 인증과 연결해보겠다.

클라이언트가 아래와 같은 요청을 보냈다고 가정해보겠다.

```
GET /api/users/me
Authorization: Bearer <JWT>
```

Spring Security Resource Server를 구성한 경우 대표적인 처리 흐름은 아래와 같다.

```
Client
  |
  | Authorization: Bearer <JWT>
  v
DelegatingFilterProxy
  |
  v
FilterChainProxy
  |
  | SecurityFilterChain 선택
  v
SecurityFilterChain
  |
  v
BearerTokenAuthenticationFilter
  |
  | Bearer Token 추출
  | JWT 인증 요청
  | 서명 및 Claim 검증
  v
SecurityContextHolder
  |
  | 인증 결과 저장
  v
AuthorizationFilter
  |
  | 요청 접근 권한 확인
  v
DispatcherServlet
  |
  v
Controller
  |
  v
Service
  |
  v
HTTP Response
```

실제로 `BearerTokenAuthenticationFilter`는 `AuthenticationManager`에 인증을 요청하고,

`JwtAuthenticationProvider`와 `JwtDecoder` 등을 통해 JWT를 검증한다.

인증에 성공하면 인증 객체를 `SecurityContextHolder`에 설정하고

이후 `AuthorizationFilter`가 해당 요청에 대한 접근 권한을 검사한다.

인증 또는 인가에 실패하면 요청이 Controller에 도달하지 못할 수 있다.

### 정리

따라서 Spring Security의 Filter 구조를 이해할 때는 아래 세 가지를 구분하는 게 중요하다.

| 구성요소 | 역할 |
| --- | --- |
| `DelegatingFilterProxy` | Servlet Container와 Spring Bean 연결 |
| `FilterChainProxy` | 요청에 맞는 SecurityFilterChain 선택 |
| `SecurityFilterChain` | 실제 보안 필터 실행 및 인증·인가 처리 |

### 전체 흐름

```
DelegatingFilterProxy
        |
        | Spring Bean에 요청 위임
        v
FilterChainProxy
        |
        | 적절한 필터 체인 선택
        v
SecurityFilterChain
        |
        | 인증 및 인가 등 보안 처리
        v
DispatcherServlet
        |
        v
Controller
```

즉, DelegatingFilterProxy가 요청을 Spring Security로 연결해주고,

FilterChainProxy가 적절한 SecurityFilterChain을 선택한 뒤,

해당 체인의 필터들이 실제 보안 처리를 수행하는 구조이다.

---

## 8. Authentication

Spring Security의 핵심 인터페이스 중 하나가 `Authentication`이다.

`Authentication`은 인증을 시도할 때 필요한 정보 또는 인증이 완료된 사용자의 정보를 표현하는 인터페이스이다.

앞서 살펴본 필터 체인에서 인증 처리가 이루어질 때 사용하는 핵심 객체이기도 하다.

예를 들어 사용자가 이메일과 패스워드로 로그인한다고 가정해보자.

```
사용자 로그인 요청
       |
       | email: example@example.com
       | password: password123@
       v
Authentication 객체 생성
       |
       | 아직 인증되지 않은 상태
       v
AuthenticationManager
       |
       | 사용자 조회
       | 패스워드 검증
       v
인증 성공
       |
       v
인증된 Authentication 반환
       |
       | 사용자 식별 정보
       | 사용자 권한 정보
       | 인증 상태
       v
인증 결과 활용
```

여기서 중요한 점은 Authentication이 인증 완료 후에만 존재하는 객체가 아니라는 것이다.

Spring Security에서는 인증 전과 인증 후 모두 Authentication을 사용할 수 있다.

### 8.1 Authentication 인터페이스

Authentication은 다음과 같은 주요 메서드를 제공한다.

```java
public interface Authentication extends Principal, Serializable {

    Collection<? extends GrantedAuthority> getAuthorities();

    Object getCredentials();

    Object getDetails();

    Object getPrincipal();

    boolean isAuthenticated();

    void setAuthenticated(boolean isAuthenticated);
}
```

`Principal`인터페이스를 상속하기 때문에 `getName()`도 사용할 수 있다.

각 메서드의 역할을 살펴보겠다.

### 8.2 Principal

`getPrincipal()` 은 인증의 주체를 반환한다.

일반적으로 누가 인증을 시도하고 있는지, 또한 누가 인증되었는지를 나타내는 정보이다.

예를 들어 아이디와 패스워드로 로그인한다면 인증 전에는 아래와 같은 값이 들어갈 수 있다.

```java
String email = "example@example.com";

Authentication authentication =
    UsernamePasswordAuthenticationToken.unauthenticated(
        email,
        "password123@"
    );

Object principal = authentication.getPrincipal();

System.out.println(principal);

// 출력 결과: example@example.com
```

이 시점에선 아직 인증되지 않았기 때문에 `principal`에 사용자가 입력한 이메일 문자열이 들어있지만

인증에 성공한 이후에는 `UserDetails` 객체가 들어갈 수 있다.

```java
Authentication authentication =
    authenticationManager.authenticate(
        UsernamePasswordAuthenticationToken.unauthenticated(
            "example@example.com",
            "password123@"
        )
    );

Object principal = authentication.getPrincipal();
```

일반적인 `DaoAuthenticationProvider`기반 인증에서는 `principal`이 `UserDetails`객체인 경우가 많다.

다만 `principal`이 항상 `UserDetails`인 건 아니다.

아래와 같이 인증 방식에 따라 달라질 수 있다.

| 인증 방식 | Principal 예시 |
| --- | --- |
| 아이디/패스워드 인증 | `UserDetails` |
| JWT Resource Server 인증 | `Jwt` |
| OAuth2 로그인 | `OAuth2User` |
| OIDC 로그인 | `OidcUser` |

따라서 `getPrincipal()`을 사용할 때에는 현재 서비스가 어떤 인증 방식을 사용하는지 알아야 한다.

### 8.3 Credentials

`getCredentials()` 는 인증에 사용되는 증명 정보를 반환한다.

대표적인 예시는 패스워드이다.

```java
Authentication authentication =
    UsernamePasswordAuthenticationToken.unauthenticated(
        "example@example.com",
        "password123@"
    );

Object credentials = authentication.getCredentials();

System.out.println(credentials);

// 출력결과: password123@
```

이 객체는 아직 인증 전이기 때문에 사용자가 입력한 패스워드를 가지고 있다.

하지만 인증 후에도 패스워드를 계속 보관하는 건 보안상 위험할 수 있기 때문에

Spring Security는 일반적인 인증 처리 과정에서 인증 완료 후 민감한 Credentials를 제거할 수 있도록 설계되어 있다.

예를 들어 `ProviderManager`는 기본적으로 인증 성공 후 인증 결과가 `CredentialsContainer`를 지원하면 Credentials를 제거한다.

중요한 건 인증이 끝난 후 불필요한 비밀번호를 메모리에 오래 보관하지 않는다는 점이다.

### 8.4 Authorities

`getAuthorities()` 는 사용자가 가진 권한 목록을 반환한다.

Spring Security에서는 권한을 `GrantedAuthority`인터페이스로 표현한다.

대표적인 권한은 아래와 같다.

```
ROLE_USER
ROLE_ADMIN
SCOPE_profile:read
SCOPE_project:write
```

예를 들어 현재 사용자가 관리자 권한을 가지고 있다면 아래와 같이 조회할 수 있다.

```java
Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();

for (GrantedAuthority authority : authorities) {
    System.out.println(authority.getAuthority());
}

/*
출력 결과: 
ROLE_USER
ROLE_ADMIN
*/
```

Spring Security는 이 권한을 통해 특정 요청에 대한 접근을 허용하거나 거부할 수 있다.

```java
http.authorizeHttpRequests(auth -> auth
    .requestMatchers("/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
);
```

### 8.5 Details

`getDetails()` 는 인증 과정에서 필요한 부가 정보를 반환한다.

예를 들어 Servlet 기반 로그인에는

- 요청을 보낸 원격 주소
- HTTP Session ID
- 메타데이터

등의 정보가 포함될 수 있는데

Spring Security에서는 `WebAuthenticationDetails` 라는 클래스를 사용하여 이러한 정보를 표현할 수 있다.

다만 `getDetails()`가 항상 `WebAuthenticationDetails`를 반환하는 건 아니다.

인증 방식이나 설정에 따라 다른 객체 또는 `null`이 반환될 수도 있다.

### 8.6 isAuthenticated()

`isAuthenticated()`는 해당 Authentication 객체가 인증된 상태로 표시되어 있는지 확인한다.

```
인증 전

인증 요청 객체

principal: example@example.com
credentials: password123@
authorities: []
authenticated: false

인증 후

인증 완료 객체

principal: UserDetails
credentials: null
authorities: [ROLE_USER]
authenticated: true
```

인증 전에는 일반적으로 `false`를 반환한다.

여기서 주의해야 할 점이 있는데

`isAuthenticated()`가 `true`라고 해서 무조건 실제 로그인한 사용자를 뜻하는 건 아니다.

예를 들어 Spring Security의 `AnonymousAuthenticationToken`도 `true`를 반환할 수 있는데,

Spring Security가 익명 사용자를 편리하게 처리하기 위해 익명 인증 객체를 사용할 수도 있기 때문이다.

따라서 아래와 같은 코드는 로그인 여부를 확인하는 용도로 불충분할 수도 있다.

```java
if (authentication.isAuthenticated()) {
    ...
}
```

Spring Security의 `authenticated()` 인가 규칙은 이러한 익명 인증 여부까지 고려해서 판단한다.

직접 로그인 여부를 검사해야 한다면 `AuthenticationTrustResolver` 등을 활용할 수 있다.

```java
AuthenticationTrustResolver trustResolver = new AuthenticationTrustResolverImpl();

boolean isAuthenticated = trustResolver.isAuthenticated(authentication);
```

이 방식은 인증 객체가 `null`인지, 익명 인증인지 등을 고려한다.

### 8.7 setAuthenticated()

`setAuthenticated()` 는 Authentication 객체의 인증 상태를 변경하기 위한 메서드이다.

하지만 인증되지 않은 객체를 임의로 인증된 상태로 바꿀 수는 없다.

```java
Authentication authentication =
    UsernamePasswordAuthenticationToken.unauthenticated(
        "example@example.com",
        "password123@"
    );

authentication.setAuthenticated(true); // IllegalArgumentException 발생
```

`UsernamePasswordAuthenticationToken`은 `setAuthenticated(true)` 호출을 막고, `IllegalArgumentException`을 던진다.

인증된 상태로 바꾸는 것은 막혀 있지만, `false`로 바꾸는 것은 허용된다.

인증 완료 객체는 권한 목록을 받는 생성 방법으로만 만들 수 있다.

```java
// 인증 전
UsernamePasswordAuthenticationToken.unauthenticated(principal, credentials);

// 인증 완료
UsernamePasswordAuthenticationToken.authenticated(principal, credentials, authorities);
```

그렇다면 인증 완료 객체는 누가 만들까 ?

아이디/패스워드 로그인에서는 개발자가 직접 만들 일이 거의 없다.

`DaoAuthenticationProvider`가 사용자 조회와 비밀번호 검증을 마친 뒤, 내부에서 인증 완료 객체를 생성해 반환한다.

커스텀 JWT 필터에서는 개발자가 직접 만들어야 한다.

```java
// JwtAuthenticationFilter extends OncePerRequestFilter

String token = resolveToken(request);

if (token != null && jwtProvider.validate(token)) {
    Long userId = jwtProvider.getUserId(token);
    List<GrantedAuthority> authorities = jwtProvider.getAuthorities(token);

    Authentication authentication =
        UsernamePasswordAuthenticationToken.authenticated(userId, null, authorities);

    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
}

filterChain.doFilter(request, response);
```

여기서 중요한 점은 `authenticated()`는 아무것도 검증하지 않는다는 것이다.

이 팩토리는 "인증됨" 표시를 붙인 객체를 만들 뿐이다.

이 객체를 신뢰할 수 있는 근거는 바로 앞의 `validate()`에 있다.

즉, `validate()`에 결함이 있어도 Spring Security는 이 객체를 그대로 믿고 인가를 진행한다.

"인증 객체는 신뢰할 수 있는 인증 처리 과정을 거쳐 생성되어야 한다"는 말은,

커스텀 필터에서는 그 과정을 개발자가 직접 책임진다는 뜻이다.

### 8.8 인증 전과 후의 Authentication 비교

이제 지금까지 정리한 내용을 실제 로그인 과정과 연결해보겠다.

#### 1. 인증 전

사용자가 이메일과 패스워드를 입력했다고 가정해보자.

```java
Authentication authentication =
    UsernamePasswordAuthenticationToken.unauthenticated(
        "example@example.com",
        "password123@"
    );
```

생성된 객체는 다음과 같다.

```
principal    = "example@example.com"
credentials  = "password123@"
authorities  = []
authenticated = false
```

#### 2. AuthenticationManager에 인증 요청

```java
Authentication result = authenticationManager.authenticate(authentication);
```

`AuthenticationManager`는 인증 처리를 담당하는 컴포넌트에 검증을 위임한다.

일반적인 아이디/패스워드를 통한 로그인에서는 아래와 같은 흐름으로 처리된다.

```
Authentication
(인증 전)
      |
      v
AuthenticationManager
      |
      v
ProviderManager (AuthenticationManager의 구현체)
      |
      v
DaoAuthenticationProvider
      |
      +------------------+
      |                  |
      v                  v
UserDetailsService   PasswordEncoder
      |                  |
      | 사용자 조회       | 비밀번호 검증
      |                  |
      +---------+--------+
                |
                v
           인증 성공
                |
                v
        Authentication 반환
           (인증 완료)
```

#### 3. 인증 후

인증에 성공하면 아래와 같은 형태의 인증 결과가 반환될 수 있다.

```
principal     = UserDetails (username=example@example.com, password=null)
credentials   = "password123@"
authorities   = [ROLE_USER]
authenticated = true
```

인증 결과에는 검증된 사용자 정보와 권한 등이 포함된다.

이후 Spring Security는 인증 객체를 `SecurityContext`에 보관하여 요청 처리 중 사용할 수 있다.

다만 `AuthenticationManager.authenticate()`를 직접 호출하는 것만으로

현재 SecurityContext에 자동으로 저장되는 건 아니다.

인증 필터 또는 로그인 처리 로직이 인증 결과를 SecurityContext에 설정하는 과정이 별도로 필요할 수 있다.

JWT 발급용 로그인 API처럼 인증 결과를 통해 토큰만 발급하는 구조에서는 인증 상태를 HTTP 세션에 저장하지 않을 수도 있다.

### 8.9 JWT 인증에서도 Authentication을 사용한다

Spring Security에서 JWT 인증을 처리하는 경우에도 인증 결과를 Authentication 객체로 표현하지만

아이디/패스워드 인증과는 사용하는 구현체가 다르다.

대표적으로 `JwtAuthenticationToken`을 사용한다.

```
Client
  |
  | Authorization: Bearer <JWT>
  v
BearerTokenAuthenticationFilter
  |
  | JWT 추출
  v
AuthenticationManager
  |
  v
JwtAuthenticationProvider
  |
  v
JwtDecoder
  |
  | 서명 및 Claim 검증
  v
JwtAuthenticationToken
  |
  | 인증된 사용자 정보
  | 권한 정보
  v
SecurityContextHolder
```

JWT 인증에서는 패스워드 대신 JWT의 서명 및 `Claim`을 검증한다.

인증에 성공하면 Spring Security는 `JwtAuthenticationToken`을 생성하여

현재 요청의 인증 정보로 사용할 수 있다.

예를 들어 Controller에서 아래와 같이 조회할 수 있다.

```java
@GetMapping("/me")
public String me(Authentication authentication) {
    return authentication.getName();
}
```

JWT Resource Server의 기본 설정에서는 `getName()`이 JWT의 sub claim을 반환하는 것이 일반적이다.

### 8.10 Authentication과 UserDetails의 차이

Authentication은 인증 요청이나 인증 결과를 표현하고

UserDetails는 아이디/패스워드 인증 등에서 사용하는 사용자 정보를 표현한다.

| 구분 | Authentication | UserDetails |
| --- | --- | --- |
| 목적 | 인증 요청 및 인증 결과 표현 | 사용자 계정 정보 제공 |
| 인증 상태 | 표현 가능 | 직접 표현하지 않음 |
| Principal | 포함 | Principal로 사용될 수 있음 |
| Credentials | 포함할 수 있음 | 비밀번호 해시 제공 |
| Authorities | 포함 | 사용자 권한 제공 |
| 주요 사용 위치 | 인증 및 인가 처리 | 사용자 조회 및 비밀번호 인증 |

```
Authentication
      |
      +-- principal
      |      |
      |      v
      |   UserDetails
      |
      +-- credentials
      |
      +-- authorities
      |
      +-- authenticated
```

위 관계도를 보면 Authentication과 UserDetails는 동일한 개념이 아닌,

UserDetails가 Authentication의 Principal로 사용될 수 있는 관계이다.

### 정리

Authentication은 Spring Security에서 인증 정보를 표현하는 핵심 인터페이스이다.

인증 전에는 사용자가 제출한 인증 정보를 담아 인증을 요청하기 위해,

인증 후에는 검증된 사용자 신원과 권한 등의 정보를 표현하기 위해 사용한다.

주요 메서드는 아래와 같다.

| 메서드 | 역할 |
| --- | --- |
| `getPrincipal()` | 인증 주체 정보 반환 |
| `getCredentials()` | 인증 증명 정보 반환 |
| `getAuthorities()` | 사용자 권한 목록 반환 |
| `getDetails()` | 인증 요청의 부가 정보 반환 |
| `isAuthenticated()` | 인증 상태 확인 |
| `setAuthenticated()` | 인증 상태 변경 |
| `getName()` | 인증 주체의 이름 반환 (`Principal`에서 상속) |

### 전체 흐름

```
사용자 로그인 요청
       |
       v
Authentication 생성
(인증 전)
       |
       v
AuthenticationManager
       |
       | 인증 처리
       v
Authentication 반환
(인증 완료)
       |
       v
SecurityContext
       |
       v
SecurityContextHolder
       |
       v
현재 요청의 인증 정보 활용
       |
       v
인가 검사 및 비즈니스 로직 실행
```

결론은 Authentication은 단순한 사용자 정보 객체가 아닌, 인증 요청부터 검증된 인증 결과까지 표현할 수 있는 Spring Security의 핵심 인터페이스이다.
