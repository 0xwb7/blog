---
title: "Spring Security - 3"
description: "Spring Security를 더 깊게 이해하기 위해 공부한 글입니다."
pubDate: 2026-10-13
category: Java
tags:
  - Spring
  - Spring Security
  - JWT
draft: false
---

## 9. AuthenticationManager와 AuthenticationProvider

앞서 `Authentication`은 인증 전후의 정보를 표현하는 인터페이스라고 설명했다.

그렇다면 사용자가 전달한 Authentication 객체를 누가 검증할까 ?

---

### 인증 처리를 담당하는 구성요소

Spring Security에서 인증 처리는 주로 세 가지 구성요소가 담당한다.

| 구성요소 | 종류 | 역할 |
| --- | --- | --- |
| `AuthenticationManager` | 인터페이스 | 인증 요청의 진입점 |
| `ProviderManager` | `AuthenticationManager`의 구현체 | 요청을 처리할 Provider를 찾아 위임 |
| `AuthenticationProvider` | 인터페이스 | 특정 인증 방식의 실제 검증 수행 |

```
Authentication (인증 전)
        |
        v
AuthenticationManager (구현체: ProviderManager)
        |
        | supports()로 처리할 Provider 탐색
        |
        +---- DaoAuthenticationProvider
        |        +-- UserDetailsService : 사용자 조회
        |        +-- PasswordEncoder    : 비밀번호 검증
        |
        +---- JwtAuthenticationProvider
        |        +-- JwtDecoder         : 서명 및 Claim 검증
        |
        +---- 기타 AuthenticationProvider
        |
        v
Authentication (인증 완료)
```

여기서 주의할 점은 `ProviderManager`가 `AuthenticationManager`다음에 거치는 단계가 아니라는 것이다.

`ProviderManager`는 `AuthenticationManager`의 구현체이다.

코드에서 AuthenticationManager를 주입받아 호출하면, 실제로 동작하는 객체는 대부분 ProviderManager이다.

실제로 어떤 Provider가 어떤 ProviderManager에 등록되는지는 SecurityFilterChain의 구성에 따라 달라진다. (9.11에서 정리할 예정)

---

### 9.1 AuthenticationManager

```java
public interface AuthenticationManager {

    Authentication authenticate(Authentication authentication)
        throws AuthenticationException;
}
```

메서드는 `authenticate()`하나이며, 하는 일은 단순하다.

인증에 성공하면 인증된 `Authentication`을 반환하고,

인증에 실패하면 `AuthenticationException`예외를 발생시킨다.

예를 들어 사용자가 아래 정보로 로그인을 요청했다고 가정해보자.

```json
{
  "email": "example@example.com",
  "password": "password123@"
}
```

먼저 인증 전 객체를 생성한다.

```java
Authentication authenticationRequest =
    UsernamePasswordAuthenticationToken.unauthenticated(
        "example@example.com",
        "password123@"
    );
```

```
principal     = "example@example.com"
credentials   = "password123@"
authorities   = []
authenticated = false
```

이 객체를 AuthenticationManager에 전달한다.

```java
Authentication authenticationResult =
    authenticationManager.authenticate(authenticationRequest);
```

인증에 성공하면 아래와 같은 객체가 반환된다.

```
principal     = UserDetails (username=example@example.com, password=null)
credentials   = null
authorities   = [ROLE_USER]
authenticated = true
```

참고로 Spring Security 7에서는 MFA를 지원하기 위해 `FACTOR_PASSWORD` 와 같은 권한이 추가될 수 있지만, 여기선 생략하겠다.

여기서 중요한 점은 `AuthenticationManager`가 비밀번호를 직접 검증하지 않는다는 것이다.

`AuthenticationManager`는 인증 요청을 받은 창구일 뿐이고,

실제 검증은 구현체가 위임한 `AuthenticationProvider`가 수행한다.

---

### 9.2 ProviderManager

`ProviderManager`는 AuthenticationManager의 대표 구현체이다.

핵심 역할은 여러 AuthenticationProvider 중에서 요청을 처리할 수 있는 Provider를 찾아 인증을 위임한다.

예를 들어 아래 세 가지 인증 방식을 지원하는 애플리케이션이 있다고 가정하자.

| 인증 방식 | 검증 대상 |
| --- | --- |
| 이메일 / 패스워드 | 사용자 조회, 패스워드 해시 비교 |
| JWT | 서명, 만료 시간 등 Claim |
| 일회용 인증 코드(OTP) | 코드 일치 여부, 만료 시간 |

위 세 방식은 검증해야 하는 대상이 모두 다르다.

이 로직을 하나의 클래스에 모으는 대신, Spring Security는 인증 방식마다

AuthenticationProvider를 분리하고, ProviderManager가 이들을 목록으로 관리한다.

```
ProviderManager
   |
   +-- DaoAuthenticationProvider           : 이메일 / 패스워드
   |
   +-- JwtAuthenticationProvider           : JWT
   |
   +-- OtpAuthenticationProvider (커스텀)  : 일회용 인증 코드
```

인증을 요청하는 쪽은 AuthenticationManager 인터페이스만 알면 되고, 인증 방식이 몇 개가 늘어나든 호출 코드는 바뀌지 않는다.

---

### 9.3 ProviderManager의 Provider 선택 방법

`ProviderManager`는 등록된 Provider를 순서대로 확인하면서 `supports()` 로 처리 가능 여부를 묻는다.

```java
boolean supports(Class<?> authentication);
```

`supports()`는 전달된 Authentication의 타입을 처리할 수 있는지만 판단한다.

예를 들어, `UsernamePasswordAuthenticationToken`이 전달되면 결과는 다음과 같다.

| Provider | `supports(UsernamePasswordAuthenticationToken.class)` |
| --- | --- |
| `DaoAuthenticationProvider` | `true` |
| `JwtAuthenticationProvider` | `false` (`BearerTokenAuthenticationToken`만 처리) |

```
ProviderManager
     |
     | UsernamePasswordAuthenticationToken
     v
JwtAuthenticationProvider.supports()
     |
     | false → 건너뜀
     v
DaoAuthenticationProvider.supports()
     |
     | true
     v
DaoAuthenticationProvider.authenticate()
```

`supports()`가 `true`라는 것은 처리 대상이라는 뜻일 뿐이고, 인증 성공을 의미하진 않는다.

성공 여부는 `authenticate()`가 결정한다.

`authenticate()` 의 결과는 세 가지이며, ProviderManager는 각각 결과마다 다른 동작을 한다.

| `authenticate()` 결과 | 의미 | `ProviderManager`의 동작 |
| --- | --- | --- |
| 인증된 `Authentication` 반환 | 인증 성공 | 즉시 결과 반환 |
| `null` 반환 | 이 Provider는 판단할 수 없음 | 다음 Provider 확인 |
| `AuthenticationException` 발생 | 인증 실패 | 예외 종류에 따라 다름 |

정리하면 

- `supports()`는 이 인증 요청 타입을 처리할 수 있는가 ?
- `authenticate()`는 실제로 인증에 성공했는가 ?

를 확인한다.

---

### 9.4 AuthenticationProvider

`AuthenticationProvider`는 특정 인증 방식의 실제 검증 로직을 담당하는 인터페이스이다.

```java
public interface AuthenticationProvider {

    Authentication authenticate(Authentication authentication)
        throws AuthenticationException;

    boolean supports(Class<?> authentication);
}
```

AuthenticationManager는 인증해달라는 요청 하나만 정의했다면

AuthenticationProvider는 “이 요청을 처리할 수 있는가 ?”라는 질문을 하나 더 한다.

이 `supports()` 덕분에 ProviderManager는 각 Provider의 내부 구현을 몰라도 위임 대상을 고를 수 있다.

주요 구현체는 아래와 같다.

| 구현체 | 처리하는 Authentication 타입 | 인증 방식 |
| --- | --- | --- |
| `DaoAuthenticationProvider` | `UsernamePasswordAuthenticationToken` | 아이디·비밀번호 |
| `JwtAuthenticationProvider` | `BearerTokenAuthenticationToken` | JWT |
| `OpaqueTokenAuthenticationProvider` | `BearerTokenAuthenticationToken` | Opaque Token |
| 커스텀 Provider | 직접 정의한 타입 | 직접 정의 |

새로운 인증 방식이 필요하면 전용 `Authentication` 구현체와 이를 처리하는 Provider를 만들어 등록하면 된다.

예를 들어 일회용 인증 코드 인증은 아래와 같은 구조를 가질 수 있다.

```java
public class OtpAuthenticationProvider implements AuthenticationProvider {

    @Override
    public Authentication authenticate(Authentication authentication) {
        OtpAuthenticationToken token = (OtpAuthenticationToken) authentication;

        // 1. 코드 일치 여부 검증
        // 2. 만료 시간 검증
        // 실패하면 BadCredentialsException 발생
        
        return OtpAuthenticationToken.authenticated( ... );
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return OtpAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
```

`supports()` 에서 `equals()` 대신 `isAssignableFrom()`을 사용하는 이유는 하위 타입까지 처리 대상으로 포함시키기 위해서이다.

---

### 9.5 DaoAuthenticationProvider

`DaoAuthenticationProvider`는 아이디/패스워드 인증의 대표 구현체이다.

직접 모든 일을 하지 않고, 두 컴포넌트에 작업을 위임한다.

- `UserDetailsService`: 사용자 정보 조회
- `PasswordEncoder`: 비밀번호 검증

#### 실제 검증 순서

인증 흐름의 골격은 상위 클래스인 `AbstractUserDetailsAuthenticationProvider`에 정의되어 있다.

순서는 아래와 같다.

```
DaoAuthenticationProvider.authenticate()
   |
   | 1. 사용자 조회
   v
UserDetailsService.loadUserByUsername()
   |
   | 2. 사전 상태 검사 (preAuthenticationChecks)
   |    - 계정 잠김     → LockedException
   |    - 계정 비활성화 → DisabledException
   |    - 계정 만료     → AccountExpiredException
   v
   | 3. 비밀번호 검증 (additionalAuthenticationChecks)
   |    - 불일치        → BadCredentialsException
   v
   | 4. 사후 상태 검사 (postAuthenticationChecks)
   |    - 비밀번호 만료 → CredentialsExpiredException
   v
   | 5. 인증 완료 객체 생성 (createSuccessAuthentication)
   v
Authentication 반환
```

여기서 중요한 점은 계정 상태 검사가 비밀번호 검증보다 먼저 일어난다는 것이다.

잠긴 계정에 틀린 비밀번호를 입력해도 `BadCredentialsException`이 아니라 `LockedException`이 발생한다.

반면 비밀번호 만료 검사는 비밀번호 검증 뒤에 있는데, 비밀번호를 아는 사용자에게만 변경하라고 안내하기 위해서이다.

#### 1. 사용자 조회

```java
UserDetails user = userDetailsService.loadUserByUsername("example@example.com");
```

```
username    = example@example.com
password    = {bcrypt}$2a$10$...
authorities = [ROLE_USER]
enabled     = true
```

사용자가 없으면 `UsernameNotFoundException`이 발생한다.

`UserDetailsService`가 DB 장애처럼 다른 예외를 던지면,

`DaoAuthenticationProvider`는 이를 `InternalAuthenticationServiceException`으로 감싼다.

#### 2. 사전 상태 검사

`UserDetails`의 `isAccountNonLocked()`, `isEnable()`, `isAccountNonExpired()`를 차례대로 확인한다.

하나라도 `false`이면 해당 예외가 발생하고, 비밀번호 검증은 실행되지 않는다.

#### 3. 비밀번호 검증

```java
passwordEncoder.matches("password123@", user.getPassword());
```

저장된 해시를 복호화하지 않고, 제출된 비밀번호를 저장된 해시와 같은 방식으로 해싱하여 결과를 비교한다.

#### 4. 사후 상태 검사

`isCredentialsNonExpired()`를 확인한다.

#### 5. 인증 완료 객체 생성

```java
UsernamePasswordAuthenticationToken.authenticated(
    user,                             // principal: UserDetails
    authentication.getCredentials(),  // 제출된 비밀번호
    user.getAuthorities()
);
```

이 시점까지는 아직 `credentials`에 제출된 비밀번호가 그대로 남아있다.

비밀번호를 지우는 건 ProviderManager의 역할이다.

---

### 9.6 UserDetailsService와 PasswordEncoder

#### UserDetailsService

`UserDetailsService`는 사용자 정보를 조회하는 인터페이스이다.

```java
public interface UserDetailsService {

    UserDetails loadUserByUsername(String username)
        throws UsernameNotFoundException;
}
```

가진 책임은 조회 한 개이다.

비밀번호 비교는 `DaoAuthenticationProvider`가 `PasswordEncoder`를 통해 한다.

메서드의 이름은 `loadUserByUsername` 인데, 이때 username은 사용자를 식별하는 값을 의미한다.

```java
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {

        User user = userRepository.findByEmail(email)
            .orElseThrow(() ->
                new UsernameNotFoundException("사용자를 찾을 수 없습니다.")
            );

        return org.springframework.security.core.userdetails.User
            .withUsername(user.getEmail())
            .password(user.getPasswordHash())
            .authorities(user.getRole().getAuthority())
            .build();
    }
}
```

위는 UserDetailsService의 예시 코드이다.

#### PasswordEncoder

`PasswordEncoder`는 비밀번호를 해싱하고, 입력된 비밀번호가 저장된 해시와 일치하는지 검증하는 인터페이스이다.

```java
public interface PasswordEncoder {

    String encode(CharSequence rawPassword);

    boolean matches(CharSequence rawPassword, String encodedPassword);

    default boolean upgradeEncoding(String encodedPassword) {
        return false;
    }
}
```

| 메서드 | 역할 |
| --- | --- |
| `encode()` | 비밀번호를 해싱하여 저장 가능한 형태로 변환 |
| `matches()` | 입력 비밀번호와 저장된 해시 비교 |
| `upgradeEncoding()` | 저장된 해시를 더 강한 방식으로 갱신해야 하는지 판단 |

```java
PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

String encodedPassword = passwordEncoder.encode("password123@");

System.out.println(passwordEncoder.matches("password123@", encodedPassword));

// 출력 결과: true
```

`BCrypt`는 해싱할 때마다 무작위 Salt를 생성하기 때문에 같은 비밀번호도 매번 다른 해시가 만들어진다.

그런데도 `matches()`가 동작하는 이유는 Salt가 해시 문자열 안에 함께 저장되어 있기 때문이다.

`matches()`는 저장된 해시에서 Salt를 꺼내 제출된 비밀번호를 같은 조건으로 해싱한 뒤 비교한다.

#### DelegatingPasswordEncoder

실무에서는 `BCryptPasswordEncoder` 를 직접 쓰기보다 `DelegatingPasswordEncoder`를 주로 사용한다고 한다.

```java
PasswordEncoder passwordEncoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
```

이 Encoder로 해싱한 결과는 아래와 같이 `{id}` 접두사를 가진다.

```
{bcrypt}$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG
```

접두사는 어떤 알고리즘으로 해싱했는지를 기록한다.

- `encode()`: 기본 알고리즘(bcrypt)으로 해싱하고 접두사를 붙인다.
- `matches()`: 저장된 해시의 접두사를 읽고, 해당 알고리즘의 Encoder에 검증을 위임한다.

덕분에 해싱 알고리즘을 바꾸더라도 기존 사용자의 해시를 그대로 검증할 수 있다.

대신 주의할 점이 있는데, 접두사 없이 저장된 해시를 `DelegatingPasswordEncoder`로 검증하면 예외가 발생한다.

```
IllegalArgumentException: There is no PasswordEncoder mapped for the id "null"
```

`BcryptPasswordEncoder`로 직접 해싱해둔 기존 데이터를 옮길 때 자주 발생할 수 있다.

#### upgradeEncoding()과 해시 자동 갱신

`upgradeEncoding()`은 로그인 과정에서 사용되는 메서드이다.

`DaoAuthenticationProvider`는 인증에 성공했을 때 아래 두 조건을 만족하면

제출된 비밀번호를 현재 기본 알고리즘으로 다시 해싱하여 저장한다.

1. `upgradeEncoding()`이 `true`를 반환
2. `UserDetailsPasswordService` Bean이 등록

평문 비밀번호는 로그인하는 순간에만 서버에 존재하기 때문에

오래된 방식의 해시를 새 방식으로 바꿀 수 있는 유일한 시점이 로그인 성공 직후이다.

사용자는 평소처럼 로그인하면 되고, 서버가 저장된 해시를 최신 방식으로 교체하는 구조이다.

---

### 9.7 AuthenticationManager 구성하기

`AuthenticationManager` 를 구성하는 방법은 크게 두 가지이다.

1. Spring Security의 자동 구성 활용
2. ProviderManager와 Provider를 직접 생성

#### 자동 구성 활용

UserDetailsService Bean과 PasswordEncoder Bean만 등록하면

Spring Security가 이 둘을 사용하는 DaoAuthenticationProvider를 만들어 ProviderManager에 등록한다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration configuration
    ) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
```

`AuthenticationConfiguration`의 `getAuthenticationManager()` 는

Spring Security가 자동으로 구성한 AuthenticationManager를 꺼내온다.

이를 Bean으로 노출하면 로그인 API 등에서 주입받아 사용할 수 있다.

#### 직접 구성

구조를 이해하기 위해 ProviderManager와 DaoAuthenticationProvider를 직접 생성해보겠다.

```java
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(PasswordEncoder passwordEncoder) {
        UserDetails user = User
            .withUsername("example@example.com")
            .password(passwordEncoder.encode("password123@"))
            .roles("USER")
            .build();

        return new InMemoryUserDetailsManager(user);
    }

    @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        DaoAuthenticationProvider provider =
            new DaoAuthenticationProvider(userDetailsService);

        provider.setPasswordEncoder(passwordEncoder);

        return new ProviderManager(provider);
    }
}
```

1. DaoAuthenticationProvider가 사용자를 조회할 수 있도록 UserDetailsService를 전달하고
2. 비밀번호 검증에 쓸 PasswordEncoder를 설정한다.
3. 이 Provider 하나를 가진 ProviderManager를 생성한다.

직접 AuthenticationManager를 구성할 때 주의할 점이 있다.

`new ProviderManager()`로 직접 만든 객체는 기본적으로 인증 성공/실패 이벤트를 발생시키지 않는다는 것이다.

내부의 이벤트 발행기가 아무 일도 하지 않는 `NullEventPublisher`로 초기화되기 때문이다.

로그인 실패 이벤트를 사용하려면 아래와 같이 이벤트 발행기를 직접 연결해줘야 한다.

```java
ProviderManager providerManager = new ProviderManager(provider);
providerManager.setAuthenticationEventPublisher(authenticationEventPublisher);
```

또한 자동 구성과 직접 구성을 섞어 쓰게 되면

어떤 AuthenticationManager가 실제로 사용되고 있는지 파악하기가 어려워지기 때문에

한 프로젝트에서는 한 가지 방식만 선택하는 것이 좋다.

---

### 9.8 로그인 API에서 AuthenticationManager 사용하기

REST API 기반 로그인에서는 Controller나 Service에서 AuthenticationManager에 직접 인증을 요청한다.

```java
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {

        Authentication authenticationRequest =
            UsernamePasswordAuthenticationToken.unauthenticated(
                request.email(),
                request.password()
            );

        Authentication authenticationResult =
            authenticationManager.authenticate(authenticationRequest);

        return ResponseEntity.ok(new LoginResponse(authenticationResult.getName()));
    }

    public record LoginRequest(String email, String password) {}

    public record LoginResponse(String username) {}
}
```

이 API가 정상 동작하려면 `/auth/login`이 `permitAll()`로 열려 있어야 한다.

또한 CSRF 보호가 켜져 있다면 POST 요청이 403으로 거부된다.

#### 인증 처리 순서

```
1. Client
   |
   | POST /auth/login
   v
2. AuthController
   |
   | UsernamePasswordAuthenticationToken.unauthenticated() 생성
   v
3. AuthenticationManager.authenticate()  (실제 객체: ProviderManager)
   |
   | supports()로 Provider 선택
   v
4. DaoAuthenticationProvider
   |
   | 사용자 조회
   | 계정 상태 사전 검사
   | 비밀번호 검증
   | 비밀번호 만료 검사
   v
5. 인증된 Authentication 반환 (credentials 제거)
   |
   v
6. AuthController
   |
   | 200 OK { "username": "example@example.com" }
   v
Client
```

이때 `authenticate()`는 인증 결과를 반환할 뿐, 세션이나 JWT를 만들어주는 건 아니다.

로그인 방식에 따라 필요한 후속 처리가 다르다.

| 로그인 방식 | 후속 처리 |
| --- | --- |
| 세션 기반 | `SecurityContext`에 인증 결과를 설정하고 `SecurityContextRepository.saveContext()`로 세션에 저장 |
| JWT 기반 | 인증 결과를 바탕으로 JWT 발급 |

세션 기반 로그인에서 `saveContext()`를 빠뜨리면

로그인 요청은 성공했지만 다음 요청에서 다시 인증되지 않은 상태가 된다,

JWT 기반이라면 아래와 같이 토큰을 발급한다.

```java
Authentication authentication =
    authenticationManager.authenticate(authenticationRequest);

String accessToken = tokenService.issueAccessToken(authentication);
```

`tokenService.issueAccessToken()`은 직접 구현한 JWT 발급 메서드이다.

`AuthenticationManager`는 사용자 인증을 담당하고, JWT 발급은 별도의 책임이다.

#### 인증에 실패했을 때

위 `AuthController`는 예외를 잡지 않는다.

비밀번호가 틀리면 `authenticate()`에서 `BadCredentialsException`이 발생하고

이 예외는 아래 경로대로 전파된다.

```
AuthController
   |
   | BadCredentialsException 발생
   v
DispatcherServlet
   |
   | 처리할 @ExceptionHandler가 없으면 예외를 그대로 던짐
   v
ExceptionTranslationFilter
   |
   | AuthenticationException 감지
   v
AuthenticationEntryPoint
   |
   | 설정에 따른 응답
   v
Client
```

`ExceptionTranslationFilter` 는 `DispatcherServlet` 앞에 위치한다.

필터는 이후 단계에서 발생한 예외를 받기 때문에

Controller에서 던진 인증 예외도 `ExceptionTranslationFilter`가 처리한다.

최종 응답은 등록된 `AuthenticationEntryPoint`에 따라 달라진다.

| 설정 | 응답 |
| --- | --- |
| `oauth2ResourceServer()` | 401 + `WWW-Authenticate: Bearer` |
| `httpBasic()` | 401 + `WWW-Authenticate: Basic` |
| `formLogin()` | 302 로그인 페이지 리다이렉트 |
| 인증 방식 설정 없음 | 403 (`Http403ForbiddenEntryPoint`) |

이때 `@RestControllerAdvice`에 `@ExceptionHandler(Exception.class)`같은 포괄적인 예외 처리기가 있으면

예외가 `ExceptionTranslationFilter`까지 가지 못하고 핸들러에서 처리되어 500을 응답한다.

로그인 API의 실패 응답을 예측 가능하게 하기 위해선 인증 예외를 명시적으로 처리해야 한다.

---

### 9.9 JWT 인증에서의 동작

지금까지는 아이디/패스워드 인증을 중심으로 봤는데

Spring Security OAuth2 Resouce Server의 JWT 인증도

같은 `AuthenticationManager` → `AuthenticationManage` 구조를 사용한다.

달라지는 건 인증 객체의 타입과 Provider이다.

```
Client
  |
  | Authorization: Bearer <JWT>
  v
BearerTokenAuthenticationFilter
  |
  | JWT 문자열 추출
  | BearerTokenAuthenticationToken 생성
  v
AuthenticationManager (구현체: ProviderManager)
  |
  | supports()로 JwtAuthenticationProvider 선택
  v
JwtAuthenticationProvider
  |
  v
JwtDecoder
  |
  | 서명 검증
  | 만료 시간(exp) 검증
  | Issuer / Audience 등 Claim 검증
  v
JwtAuthenticationConverter
  |
  | Claim → 권한 변환
  v
JwtAuthenticationToken
  |
  v
SecurityContextHolder
  |
  v
AuthorizationFilter
  |
  v
Controller
```

| 구분 | 아이디·비밀번호 인증 | JWT 인증 |
| --- | --- | --- |
| 인증 전 객체 | `UsernamePasswordAuthenticationToken` | `BearerTokenAuthenticationToken` |
| Provider | `DaoAuthenticationProvider` | `JwtAuthenticationProvider` |
| 검증 대상 | 비밀번호 | JWT 서명 및 Claim |
| 주요 컴포넌트 | `UserDetailsService`, `PasswordEncoder` | `JwtDecoder`, `JwtAuthenticationConverter` |
| 인증 후 객체 | `UsernamePasswordAuthenticationToken` | `JwtAuthenticationToken` |
| 인증 후 principal | `UserDetails` | `Jwt` |

여기서 두 가지를 짚고 넘어가야 하는데

**첫 번째는 권한 변환 규칙이다.**

`JwtAuthenticationConverter`는 기본적으로 scope 또는 scp claim을 읽어 `SCOPE_` 접두사를 붙인 권한으로 변환한다.

JWT에 `“role” : “ADMIN”` claim을 넣고 `hasRole("ADMIN")`으로 검사하면 동작하지 않는다.

`hasRole("ADMIN")`은 `ROLE_ADMIN` 권한을 찾지만 기본 변환기는 `role` claim을 읽지 않기 때문인데

이 경우 `JwtGrantedAuthoritiesConverter`를 설정하여 읽을 claim과 접두사를 바꿔야 한다.

**두 번째는 검증 실패 시의 응답이다.**

`JwtDecoder`에서 서명이나 만료 검증이 실패하면 `InvalidBearerTokenException`이 발생하는데

이 예외는 `BearerTokenAuthenticationEntryPoint`로 전달되어 401과 함께 아래 헤더를 응답한다.

```
WWW-Authenticate: Bearer error="invalid_token", error_description="..."
```

#### 커스텀 JWT 필터와의 차이

몇몇 프로젝트는 Resource Server 대신 `OncePerRequestFilter`를 상속한 커스텀 필터로 JWT를 처리한다.

이 방식은 대부분 `AuthenticationManager`를 거치치 않고 직접 JWT를 검증하고

`UsernamePasswordAuthenticationToken.authenticated()`로 인증 완료 객체를 만들어

`SecurityContextHoler` 에 설정한다.

| 구분 | Resource Server | 커스텀 `OncePerRequestFilter` |
| --- | --- | --- |
| 검증 주체 | `JwtAuthenticationProvider` + `JwtDecoder` | 개발자가 작성한 검증 코드 |
| `AuthenticationManager` 경유 | O | 보통 X |
| 인증 이벤트 발행 | O | X |
| 실패 응답 | `BearerTokenAuthenticationEntryPoint` (401) | 직접 구현 |
| 인증 후 객체 | `JwtAuthenticationToken` | 개발자가 선택 (주로 `UsernamePasswordAuthenticationToken`) |

여기서 실패 처리를 주의깊게 봐야 하는데,

커스텀 필터는 보통 `addFilterBefore(..., UsernamePasswordAuthenticationFilter.class)`로 등록하는데

이 위치는 `ExceptionTranslationFilter`보다 앞이다.

`ExceptionTranslationFilter`는 자신보다 뒤에서 발생한 예외만 처리하기 때문에

커스텀 필터에서 던진 인증 예외는 `AuthenticationEntryPoint`로 전달되지 않는다.

이게 바로 커스텀 필터에서 응답을 직접 작성하거나, 예외 처리 전용 필터를 앞에 두는 이유이다.

마지막으로, JWT 인증은 매 요청마다 비밀번호를 다시 검증하지 않는다.

계정 정지나 권한 변경을 즉시 반영해야 하다면 추가적인 DB 조회가 필요하다.

---

### 9.10 인증에 실패하면 ?

#### 대표적인 인증 예외

| 예외 | 발생 시점 | 의미 |
| --- | --- | --- |
| `UsernameNotFoundException` | 사용자 조회 | 사용자 없음. 기본 설정에서는 `BadCredentialsException`으로 변환되어 밖으로 나오지 않음 |
| `InternalAuthenticationServiceException` | 사용자 조회 | 조회 중 시스템 오류 (DB 장애 등) |
| `LockedException` | 사전 상태 검사 | 잠긴 계정 |
| `DisabledException` | 사전 상태 검사 | 비활성화된 계정 |
| `AccountExpiredException` | 사전 상태 검사 | 만료된 계정 |
| `BadCredentialsException` | 비밀번호 검증 | 비밀번호 불일치 |
| `CredentialsExpiredException` | 사후 상태 검사 | 비밀번호 만료 |
| `ProviderNotFoundException` | `ProviderManager` | 요청을 처리할 Provider가 없음 |

`LockedException`, `DisabledException`, `AccountExpiredException`, `CredentialsExpiredException`은 모두 `AccountStatusException`의 하위 클래스이다.

#### 계정 존재 여부를 숨기는 장치

로그인 실패 응답이 “존재하지 않는 계정”과 “비밀번호를 틀린 경우”를 구분하면

공격자는 어떤 이메일이 가입되어 있는지 알아낼 수 있다.

`DaoAuthenticationProvider`는 이를 막기 위해 두 가지 장치를 가지고 있는데

**첫 번째는 예외 변환이다.**

`hideUserNotFoundExceptions`의 기본값은 true이기 때문에

`UsernameNotFoundException`은 `BadCredentialsException` 으로 변환되고, 같은 예외로 보인다.

**두 번째는 응답 시간 보정이다.**

예외를 통일해도 응답 시간이 다르면 소용이 없다.

사용자가 없을 때 해시 비교를 건너뛰면, 존재하지 않는 계정의 응답이 눈에 띄게 빨라진다.

BCrypt 해시 비교는 의도적으로 느리게 설계되어 있기 때문이다.

이 시간 차이로 계정 존재 여부를 추측하는 것을 타이밍 공격이라고 한다.

이를 막기 위해 `DaoAuthenticationProvider`는 사용자를 찾지 못했을 떄에도

미리 준비한 더미 해시로 `matches()`를 실행하여 응답 시간을 맞춘다.

#### 상태 검사 경로

9.5를 보면 계정 상태 검사가 비밀번호 검증보다 먼저 실행된다고 했다.

따라서 잠긴 계정에 아무 비밀번호나 입력해도 `LockedException`이 발생하게 되는데

이 예외를 그대로 계정이 잠겼음을 뜻하는 메시지로 응답하면

공격자는 비밀번호를 몰라도 해당 계정이 존재하도 잠겨 있음을 알게 된다.

앞의 두 장치가 막아둔 정보가 이 경로로 새어 나가게 되는 것이다.

| 정책 | 장점 | 단점 |
| --- | --- | --- |
| 상태 예외도 "이메일 또는 비밀번호가 올바르지 않습니다"로 통일 | 계정 존재 여부 노출 차단 | 정당한 사용자가 잠김 사실을 알 수 없음 |
| 상태 예외는 구분해서 안내 | 사용자가 원인을 바로 알 수 있음 | 계정 존재 여부 노출 |

만약 통일하기로 결정했다면, 계정 잠김 안내는 이메일처럼 계정 소유자만 받을 수 있게 한다.

9.8의 로그인 API에서 이 정책을 적용하면 다음과 같이 작성할 수 있다.

```java
@RestControllerAdvice
public class AuthExceptionHandler {

    @ExceptionHandler({BadCredentialsException.class, AccountStatusException.class})
    public ResponseEntity<ErrorResponse> handleLoginFailure(AuthenticationException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ErrorResponse(
                "INVALID_CREDENTIALS",
                "이메일 또는 비밀번호가 올바르지 않습니다."
            ));
    }
}
```

이 핸들러는 Controller에서 발생한 예외만 처리하므로 필터에서 발생하는 인증 예외에는 영향을 주지 않는다.

#### ProviderManager의 실패 처리

여러 Provider가 등록되어 있을 때 하나의 Provider가 실패하면 어떻게 될까 ?

`ProviderManager.authenticate()`를 단순화하면 아래와 같다.

```java
for (AuthenticationProvider provider : getProviders()) {

    if (!provider.supports(toTest)) {
        continue;
    }

    try {
        result = provider.authenticate(authentication);
        if (result != null) {
            break;
        }
    } catch (AccountStatusException | InternalAuthenticationServiceException ex) {
        throw ex;
    } catch (AuthenticationException ex) {
        lastException = ex;
    }
}

if (result == null && parent != null) {
    result = parent.authenticate(authentication);
}

if (result != null) {
    return result;
}

if (lastException == null) {
    lastException = new ProviderNotFoundException(...);
}

throw lastException;
```

예외 종류에 따라 처리가 명확히 나뉘게 된다.

| 예외 | 처리 | 이유 |
| --- | --- | --- |
| `AccountStatusException` | 즉시 종료 | 계정 자체에 문제가 있음 |
| `InternalAuthenticationServiceException` | 즉시 종료 | 시스템 오류임 |
| 그 외 `AuthenticationException` | 기록 후 다음 Provider | 다른 Provider가 인증할 수 있음 |

계정 상태 예외가 즉시 종료되는 이유를 생각해보면

잠긴 계정을 다른 Provider가 다시 인증해주면 계정 잠금이 무의미해진다.

시스템 오류가 즉시 종료되는 이유도 비슷하다.

DB 장애를 자격 증명이 틀렸다 같은 실패로 취급해서 다음 Provider로 넘기게 되면

서버 장애가 인증 실패에 덮혀 숨겨진다.

9.5에서 `DaoAuthenticationProvider`가 조회 중 발생한 예외를

`InternalAuthenticationServiceException`으로 감싼 이유이다.

#### 실패 이벤트로 로그인 시도 횟수 제한

ProviderManager는 인증 성공과 실패 시 이벤트를 발생시킨다.

이를 이용하면 로그인 실패 횟수를 세는 로직을 인증 코드와 분리할 수 있다.

```java
@Component
public class LoginFailureListener {

    @EventListener
    public void onFailure(AuthenticationFailureBadCredentialsEvent event) {
        String username = event.getAuthentication().getName();

        // 실패 횟수 증가
        // 임계치를 넘으면 계정 잠금 처리
    }
}
```

스프링 부트는 `AuthenticationEventPublisher`를 자동으로 등록하기 때문에

자동 구성된 `AuthenticationManager`에서는 별도 설정 없이 동작한다.

단, 9.7처럼 `new ProviderManager()`로 직접 생성했다면 이벤트 발행기를 연결해야 한다.

실패 횟수 제한과 함께 IP 단위 요청 속도 제한도 설계할 수 있으면 해야 한다.

계정 단위 제한만 있으면 공격자가 여러 계정을 번갈아 시도하는 경우를 막지 못하기 때문이다.

---

### 9.11 ProviderManager의 추가 기능

#### Credentials 제거

8.3에서 인증이 끝난 비밀번호를 메모리에 남기지 않는다고 설명했다.

9.5에서 본 것처럼 `DaoAuthenticationProvider`는 제출된 비밀번호를 `credentials`에 그대로 담아 반환한다.

비밀번호를 지우는 건 결과를 받은 ProviderManager이다.

```java
// ProviderManager.authenticate() 마지막 부분 단순화
if (result != null) {
    if (eraseCredentialsAfterAuthentication
            && result instanceof CredentialsContainer container) {
        container.eraseCredentials();
    }
    return result;
}
```

`eraseCredentialsAfterAuthentication`의 기본값은 `true`이다.

`UsernamePasswordAuthenticationToken.eraseCredentials()`는

- 자신의 `credentials`을 `null`로 만들어 지우고
- `principal`이 `CredentialsContainer`를 구현하면 그것도 지운다.

Spring Security의 User는 CredentialsContainer를 구현하므로 UserDetails가 가진 비밀번호 해시까지 `null`이 된다.

9.1의 인증 결과에서 `credentials`와 `UserDetails`의 비밀번호가 모두 `null`이었던 이유가 이것이다.

이 구조에서 두 가지 결과가 나오는데

**첫 번째는 Provider를 직접 호출하면 Credentials가 지워지지 않는다는 것**이다.

제거는 `ProviderManager`의 기능이기 때문에 `DaoAuthenticationProvider.authenticate()`를

직접 호출한 결과에는 비밀번호가 남아있다.

**두 번째는 캐시와 함께 사용할 땐 부작용이 생길 수 있다는 것**이다.

UserDetailsService가 캐시에 보관한 User 객체를 그대로 반환한다고 가정해보자.

인증 결과의 principal과 캐시 안의 객체가 같은 인스턴스이므로 Credentials 제거가 캐시된 객체의 비밀번호 해시까지 지우면 

다음 로그인에서 비교할 해시가 없기 때문에 인증이 실패한다.

이 경우 캐시에서 꺼낸 객체의 복사본을 반환하도록 하면 문제를 피할 수 있다.

#### Parent AuthenticationManager

`ProviderManager`는 상위 `AuthenticationManage`를 부모로 가질 수 있다.

자신의 Provider 중 아무도 인증 결과를 내지 못하면, 부모에게 인증을 위임한다.

이 구조는 Spring Security 내부에서 실제로 사용되는데

`SecurityFilterChain`마다 `HttpSecurity`는 자신만의 `ProviderManager`를 만들고,

전역 `AuthenticationManager`를 부모로 연결한다.

```
SecurityFilterChain A의 ProviderManager
   |
   | http.authenticationProvider()로 등록한 Provider
   |
   | 처리하지 못하면 (result == null)
   v
  부모: 전역 AuthenticationManager
   |
   | UserDetailsService Bean 기반 DaoAuthenticationProvider 등
   v
인증 결과
```

덕분에 각 필터 체인은 자신만의 인증 방식을 가지면서, 전역에 등록된 공통 인증 방식도 함께 사용할 수 있다.

---

### 정리

| 구성요소 | 역할 |
| --- | --- |
| `AuthenticationManager` | 인증 요청의 진입점이 되는 인터페이스 |
| `ProviderManager` | `AuthenticationManager`의 구현체. Provider 선택, 실패 처리, Credentials 제거, 이벤트 발행 |
| `AuthenticationProvider` | 특정 인증 방식의 실제 검증을 수행하는 인터페이스 |
| `DaoAuthenticationProvider` | 아이디·비밀번호 인증 구현체 |
| `JwtAuthenticationProvider` | JWT 인증 구현체 |
| `UserDetailsService` | 사용자 정보 조회 |
| `PasswordEncoder` | 비밀번호 해싱 및 검증 |

#### 아이디/패스워드 인증의 전체 흐름

```
Client
   |
   | 이메일 / 비밀번호
   v
UsernamePasswordAuthenticationToken (authenticated = false)
   |
   v
AuthenticationManager (구현체: ProviderManager)
   |
   | supports()로 Provider 선택
   v
DaoAuthenticationProvider
   |
   | 1. UserDetailsService  : 사용자 조회
   | 2. 사전 상태 검사       : 잠김 / 비활성화 / 계정 만료
   | 3. PasswordEncoder     : 비밀번호 검증
   | 4. 사후 상태 검사       : 비밀번호 만료
   v
ProviderManager
   |
   | Credentials 제거
   | 인증 성공 이벤트 발행
   v
UsernamePasswordAuthenticationToken (authenticated = true)
```

#### JWT 인증의 전체적인 흐름

```
Client
   |
   | Authorization: Bearer <JWT>
   v
BearerTokenAuthenticationFilter
   |
   | BearerTokenAuthenticationToken 생성
   v
AuthenticationManager (구현체: ProviderManager)
   |
   v
JwtAuthenticationProvider
   |
   | JwtDecoder                 : 서명 및 Claim 검증
   | JwtAuthenticationConverter : 권한 변환
   v
JwtAuthenticationToken
   |
   v
SecurityContextHolder
```
