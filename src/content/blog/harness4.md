---
title: "하네스 엔지니어링 - 3차 실험"
description: "하네스 엔지니어링 3차 실험글입니다."
pubDate: 2026-10-19
category: AI
tags:
  - AI
  - 하네스 엔지니어링
  - Harness Engineering
draft: false
---

## 1. 시작하며

지금까지 하네스 엔지니어링을 적용했을 때와 적용하지 않았을 때 AI의 코드 작성 결과가 얼마나 달라지는지 실험했다.

1차에는 회원가입/로그인, JWT 인증 기능을 구현했고, 2차에는 Refresh Token 로테이션과 재사용 탐지 기능을 추가했다.

앞선 실험에서는 하네스를 적용한 쪽 토큰을 약 206% 정도 더 많은 토큰을 사용했지만 기능적인 부분에서 더 좋은 결과를 보여주었다.

구현 난이도가 더 높아지는 상황에서도 하네스를 적용한 쪽이 더 좋은 결과를 만들어낼까 ? 가 궁금해져서

이번 3차 실험에는 Refresh Token 재발급 과정에서 발생할 수 있는 동시성 문제를 해결하도록 했다.

프롬프트는 아래와 같다.

```markdown
# 작업: Refresh Token 동시 재발급 안전성 및 Grace Period 구현

현재 Spring Boot 프로젝트에는 회원가입·로그인·JWT Access Token 인증·내 정보 조회와, 2차 실험에서 구현한 Refresh Token 발급·회전·재사용 탐지·로그아웃이 있습니다.

기존 기능을 유지하면서 **동시에 들어오는 Refresh Token 재발급 요청의 경쟁 상태(Race Condition)**를 해결하고, **회전 직후 5초 유예 구간(Grace Period)** 정책을 구현해 주세요.

## 기술 환경

- Java 21, Spring Boot 4.1.1, Gradle
- Spring Security, Spring Data JPA
- 기존 H2 기반 로컬 실행은 가능한 한 유지
- **동시성 정확성 검증에는 MySQL 8.4(InnoDB) + Testcontainers 사용**
- **MySQL의 기본 트랜잭션 격리 수준인 `REPEATABLE READ`에서도 동시성 정확성을 검증**
- Docker가 필요한 검증은 실패·미실행 이유를 구분해서 보고
- 기존 패키지 구조와 HTTP API 계약을 가능한 한 유지

격리 수준을 변경해 문제를 해결한 경우에는 변경 이유와 영향을 명확하게 보고해 주세요.

## 1. 동시 Refresh Token 재발급의 원자성

기존 `POST /api/auth/refresh` 요청·응답 형식을 유지합니다.

동일한 **현재 유효한 Refresh Token T0**에 대해 N개의 재발급 요청이 동시에 들어오면 다음을 만족해야 합니다.

1. **오직 1개의 요청만** HTTP 200으로 성공하고, 새로운 Access Token과 Refresh Token T1을 발급합니다.
2. 나머지 요청은 HTTP 401로 거부합니다. 거부된 요청은 새 토큰을 발급하거나 세션을 추가로 회전시키면 안 됩니다.
3. 중복 요청이 첫 성공 직후 **5초 유예 구간 내**에 처리되었다면, 거부된 요청 때문에 세션이 폐기되어서는 안 됩니다.
4. 성공한 요청이 받은 T1은 다른 동시 요청들이 거부된 뒤에도 정상적으로 재발급에 사용할 수 있어야 합니다.
5. DB에 현재 유효한 Refresh Token이 중복되거나, 세션이 부분적으로 갱신되는 상태가 발생하면 안 됩니다.
6. 서로 다른 세션의 재발급은 서로 영향을 주지 않아야 합니다.
7. 요구사항은 단일 애플리케이션 JVM뿐 아니라 **같은 MySQL 데이터베이스를 사용하는 여러 인스턴스**에서도 성립해야 합니다.

JVM 내부의 `synchronized`, `ReentrantLock`만으로 해결하지 마세요.

동시 요청을 처리하는 방식은 DB 기반 잠금, 조건부 갱신, 낙관적 락 등에서 스스로 선택하고 선택 이유를 설명해 주세요.

## 2. 회전된 Refresh Token의 5초 Grace Period

이전 토큰의 회전이 **성공적으로 확정된 시각**을 기준으로 유예 구간을 계산합니다.

- 회전 완료 시각부터 **5초 이내(경계 5초 포함)**에 이미 사용된 토큰을 다시 제출하면 HTTP 401을 반환하지만 세션은 폐기하지 않습니다.
- 유예 구간이 끝난 후(**5초 초과**) 이미 회전된 토큰을 다시 제출하면 HTTP 401을 반환하고 해당 인증 세션을 폐기합니다.
- 세션이 폐기되면 해당 세션의 최신 Refresh Token도 HTTP 401로 거부합니다.
- 다른 로그인 세션은 유지됩니다.
- Grace Period 안의 중복 요청에 기존 토큰이나 새 Refresh Token을 다시 전달하지 마세요.
- 무효한 랜덤 토큰, 만료된 토큰, 로그아웃으로 폐기된 세션은 기존처럼 거부하고 이들로 다른 세션을 폐기하지 마세요.
- 토큰 원문을 DB나 로그에 저장하지 마세요.

**2차 정책 변경사항:** 2차에서는 회전된 토큰의 재사용이 즉시 해당 세션을 폐기했으나, 3차에서는 5초 이내 중복 재사용의 경우 세션을 유지합니다.

기존 테스트 중 이 정책과 충돌하는 테스트는 변경된 요구사항에 맞게 수정하고 그 이유를 보고해 주세요.

5초 이후의 재사용 탐지는 그대로 유지합니다.

## 3. 트랜잭션과 실패 처리

- 재발급 과정의 토큰 검증, 회전 상태 변경, 새 토큰 저장을 하나의 일관된 트랜잭션 경계에서 처리해야 합니다.
- **재사용 탐지에 따른 세션 폐기 기록이 HTTP 401을 반환하는 과정에서 롤백되지 않도록** 설계해 주세요.
- DB 예외나 중간 실패가 발생해도 현재 세션 및 토큰 상태가 불완전하게 남지 않아야 합니다.
- DB 제약조건(예: 토큰 해시 유일성)과 잠금 범위를 적절하게 적용해 주세요.
- 서버 시간을 직접 호출하는 대신 `Clock` 등 테스트 가능한 시간 추상화를 사용할 것을 권장합니다.

## 4. 기존 기능 유지

- `POST /api/auth/signup`
- `POST /api/auth/login` (Access Token + 14일 만료의 불투명 Refresh Token)
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/users/me`
- Access Token HS256, 유효 기간 1시간
- Refresh Token 원문 비저장·SHA-256 해시 저장
- 누락되거나 빈 Refresh Token은 HTTP 400
- 유효하지 않은 Refresh Token은 HTTP 401
- 로그아웃은 해당 세션에만 영향을 줌

기존 코드에 결함이 있다면 필요한 범위에서 수정할 수 있으나, 변경사항과 이유를 별도로 보고해 주세요.

## 5. 테스트 요구사항

다음 항목을 자동화 테스트에 포함해 주세요.

1. 동일한 Refresh Token에 16~32개 동시 재발급 요청 → **정확히 한 건 성공**
2. 실패한 중복 요청들 뒤에도 성공 토큰으로 재발급 가능
3. 짧은 간격의 이전 토큰 재사용 → 401 + 세션 유지
4. 5초 초과한 이전 토큰 재사용 → 401 + 해당 세션 폐기
5. Grace Period 5초 경계 전·후 테스트
6. 다른 인증 세션의 독립성
7. 로그아웃 및 잘못된 입력 처리의 회귀 테스트
8. **MySQL 8.4 Testcontainers 기반 동시성 통합 테스트**
9. 트랜잭션 실패·롤백 상황에서 DB 상태 일관성 검증
10. 기존 회원가입·로그인·JWT 인증·Refresh Token 기능의 회귀 테스트
11. 가능하다면 동일한 MySQL을 사용하는 두 애플리케이션 인스턴스에서 경쟁 요청 검증

동시성 테스트는 16~32개 스레드를 사용해 반복적으로 수행하고, 실제 DB 격리 수준도 확인해 주세요.

**H2에서 테스트가 통과한 것만으로 MySQL의 동시성 정확성이 검증됐다고 보고하지 마세요.**

MySQL 통합 테스트 실행 여부와 실제 결과를 따로 보고해 주세요.

## 6. 작업 방식 및 최종 보고

프로젝트 구조를 먼저 확인한 다음 스스로 설계·구현·테스트를 진행해 주세요. 추가 질문 없이 작업을 완료해 주세요.

가능한 경우 빌드와 테스트를 실제 실행하세요.

Gradle·Docker·네트워크 등의 실행 환경 문제로 검증이 차단되면 실패 이유와 실행하지 못한 범위를 구분해서 기록하세요.

성공하지 않은 검증을 통과했다고 보고하지 마세요.

최종 보고에는 다음을 포함해 주세요.

1. 구현한 동시성 제어 방식과 선택 이유
2. 5초 Grace Period의 정확한 의미 및 경계 처리
3. 트랜잭션·잠금·세션 폐기 처리 구조
4. 추가·수정한 클래스 및 테스트
5. **MySQL 8.4에서 실제 실행한 테스트 명령과 통과·실패·미실행 결과, 격리 수준**
6. 기존 기능 변경사항 및 미해결 문제
```

그런데 실험을 진행하면서 예상하지 못했던 결과를 발견했다. 

처음에는 두 환경 모두 모든 테스트와 평가를 통과했는데,

실제 데이터베이스를 연결해 동시 요청을 테스트하자 하네스를 적용한 쪽에서만 문제가 발생했다.

그리고 문제를 추적하는 과정에서 데이터베이스의 트랜잭션 격리 수준과 스프링의 트랜잭션 처리 방식까지 살펴봤다.

이번 글에서는 3차 실험의 결과와 함께, MySQL에서 발견한 동시성 문제를 분석한 과정을 정리해보겠다.

---

## 2. 실험 개요

### no-harness 구조

```
No Harness

사용자 프롬프트
      |
      v
  Codex Agent
      |
      v
     구현
      |
      v
     결과
```

### harness-test 구조

```
사용자 프롬프트
      |
      v
Main Orchestrator
      |
      v
   Planner
   구현 계획 수립
      |
      v
  Generator
   코드 구현
      |
      v
Main Orchestrator
   검증 스크립트 실행
      |
      v
  Evaluator
   독립적인 코드 평가
      |
      +---- 문제가 있다면 ----+
      |                    |
      v                    v
    PASS               Generator
                          수정
                           |
                           v
                         재검증
```

두 환경에 동일한 프롬프트를 전달했고, 동일한 모델 설정과 실행환경을 사용했으며

코덱스가 작성한 코드에 대해서는 별도의 외부 평가 스크립트를 실행했다.

또한 다음 정보를 각각 기록했다.

- Codex 실행 시간
- Input Tokens / Cached Input Tokens
- Output Tokens / Reasoning Output Tokens
- 전체 토큰 사용량
- Gradle 빌드 결과
- 외부 HTTP 기능 평가 결과
- 추가 데이터베이스 동시성 검증 결과

---

## 3. 3차 실험의 요구사항

### 3.1 Refresh Token Rotation

Refresh Token Rotation은 기존 Refresh Token으로 새로운 토큰을 발급받을 때 이전 Refresh Token을 무효화하는 방식이다.

일반적인 재발급 흐름은 아래와 같다.

```
로그인
  |
  v
Refresh Token A 발급
  |
  v
A로 재발급 요청
  |
  v
Access Token 재발급
Refresh Token B 발급
  |
  v
Refresh Token A 무효화
```

그런데 여기서 동시성 문제가 발생할 수 있다.

만약 동일한 Refresh Token A로 여러 요청이 들어온다고 가정해보자.

```
        Refresh Token A
               |
     +---------+---------+
     |         |         |
     v         v         v
   요청 1     요청 2     요청 3
     |         |         |
     v         v         v
  유효 확인  유효 확인  유효 확인
     |         |         |
     v         v         v
   Token B   Token C   Token D
```

세 요청 모두 토큰이 유효하다고 판단이 되면, 하나의 Refresh Token으로 여러 개의 Refresh Token을 발급할 수 있다.

그리고 이것이 이번에 방지하려는 문제였다.

### 3.2 기댓값

이번 실험에서는 동일한 Refresh Token으로 16개의 요청을 동시에 보내도록 했다.

기대 결과는 아래와 같다.

```
동일한 Refresh Token

동시 요청 16개
      |
      +---- 요청 1  -> 200 OK
      |
      +---- 요청 2  -> 401 Unauthorized
      |
      +---- 요청 3  -> 401 Unauthorized
      |
      ...
      |
      +---- 요청 16 -> 401 Unauthorized
```

200 OK는 정확히 1개, 401은 15개여야 한다.

그리고 성공한 요청에서 발급받은 새로운 Refresh Token은 정상적으로 사용할 수 있어야 한다.

중복 발급뿐만 아니라, 경쟁 이후에도 세션의 정상 동적을 보장해야 한다.

### 3.3 유예 구간

두 번째 요구사항은 토큰 재사용에 대한 유예 구간이었다.

일반적으로 이미 회전된 Refresh Token이 다시 사용된다면 토큰 탈취를 의심할 수 있지만

네트워크 문제 등으로 클라이언트가 같은 요청을 다시 전송하는 상황일 수도 있다.

따라서 이번 실험에서는 회전 후 5초를 기준으로 정책을 구분했다.

```
Refresh Token A
      |
      | 최초 재발급
      v
Refresh Token B 발급
      |
      +---- 3초 뒤 A 재사용
      |         |
      |         v
      |       401 응답
      |       세션 유지
      |
      +---- 6초 뒤 A 재사용
                |
                v
              401 응답
              세션 폐기
```

유예 구간을 뒀다고 해서 재사용을 허용한다는 것은 아니고

재사용 요청은 언제나 거부하지만, 5초 이내의 요청이라면 정상 세션을 폐기하지 않는 정책이다.

물론 5초라는 시간으로 정상적인 재시도와 공격자의 토큰 재사용을 구분할 수 있다고는 할 수 없지만 편의상 ㅎㅎ

### 3.4 데이터베이스 기반 동시성 보장

추가로 동시성 제어는 하나의 JVM 내부에서만 성립해서는 안 된다고 요구했다.

예를 들어 `synchronized`만 사용하면 하나의 애플리케이션 인스턴스에서는 동시 요청을 제어할 수 있지만

서로 다른 서버 인스턴스 사이에서는 안 되기 때문에 데이터베이스의 트랜잭션 및 잠금 기능을 활용하여 동시성을 보장할 수 있도록 요구했다.

---

## 4. 3차 실험 결과

### 4.1 실행 시간

| 항목 | No Harness | Harness |
| --- | --- | --- |
| 실행 시간 | 147초 | 496초 |
| 분 단위 | 2분 27초 | 8분 16초 |
| 실행 종료 코드 | 0 | 0 |

Harness의 실행 시간은 No Harness보다 약 237% 증가했다. 대략 3배 이상의 시간이 걸린 것이다.

1차와 2차에서도 Harness가 더 오래 걸리긴 했지만, 이번에는 그 차이가 특히 크게 나타났다.

### 4.2 토큰 사용량

| 항목 | No Harness | Harness |
| --- | --- | --- |
| Input Tokens | 902,043 | 4,562,506 |
| Cached Input Tokens | 854,784 | 4,395,392 |
| Output Tokens | 10,765 | 39,031 |
| Reasoning Output Tokens | 2,491 | 14,465 |
| **Total Tokens** | **912,808** | **4,601,537** |

Harness가 No Harness보다 약 404% 더 많은 토큰을 사용했다.

### 4.3 Harness 에이전트별 사용량

| 에이전트 | 총 토큰 | 전체 비중 |
| --- | --- | --- |
| Main | 1,654,163 | 약 35.9% |
| Planner | 144,505 | 약 3.1% |
| Generator | 2,049,611 | 약 44.5% |
| Evaluator | 753,258 | 약 16.4% |
| **합계** | **4,601,537** | **100%** |

이번에는 Generator가 전체 토큰의 약 44.5%를 사용했다.

실제 구현을 담당하는 Generator의 비중이 가장 컸지만, Main과 Evaluator의 사용량도 꽤나 많다.

메인 오케스트레이터와 독립 평가를 위해서 많은 컨텍스트가 처리되고 있는 것 같다.

---

## 5. 기능평가 - 1

구현이 끝난 뒤 외부 Python 스크립트로 HTTP API를 평가했다.

동시성 검증에는 다음 조건을 사용했다.

```bash
python3 ../experiment-results/phase3_eval.py \
  --base-url http://localhost:8080 \
  --workers 16 \
  --rounds 5 \
  --out ../experiment-results/phase3-eval.csv
```

동일 Refresh Token으로 16개의 동시 요청을 보내는 검사를 5회 반복했다.

### 5.1 결과

| 평가 항목 | No Harness | Harness |
| --- | --- | --- |
| 로그인 및 토큰 발급 | PASS | PASS |
| 순차 재발급 | PASS | PASS |
| 5초 이내 재사용 거부 | PASS | PASS |
| 5초 이내 재사용 후 세션 유지 | PASS | PASS |
| 독립 세션 유지 | PASS | PASS |
| 동시 요청 중 정확히 1개 성공 | PASS | PASS |
| 나머지 15개 요청 거부 | PASS | PASS |
| 경쟁 이후 성공 세션 유지 | PASS | PASS |
| 동시 요청 5회 반복 | PASS | PASS |
| 5초 초과 재사용 거부 | PASS | PASS |
| 5초 초과 재사용 시 세션 폐기 | PASS | PASS |
| 세션 간 독립성 | PASS | PASS |
| 로그아웃 | PASS | PASS |
| 로그아웃 후 재발급 거부 | PASS | PASS |
| **자동 평가 합계** | **14/14** | **14/14** |

두 환경 모두 모든 평가를 통과했고, 로컬 Gradle 빌드도 모두 성공했다.

---

## 6. 실제 MySQL 연결

동시성 문제를 검증하는 실험이기 때문에 실제 RDB를 연결해서 확인했다.

MySQL 컨테이너는 다음처럼 준비했다.

```bash
docker run -d \
  --name phase3-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=phase3_no \
  -e MYSQL_USER=test \
  -e MYSQL_PASSWORD=test123 \
  -p 127.0.0.1:3307:3306 \
  mysql:8.4
```

두 구현이 같은 데이터를 공유하지 않도록 데이터베이스를 분리했다. (phase3_no / phase3_h)

---

## 7. 기능평가 - 2

MySQL을 연결한 뒤 동일한 HTTP 평가를 다시 실행했다.

### 7.1 결과

| 항목 | No Harness | Harness |
| --- | --- | --- |
| 일반 재발급 | PASS | PASS |
| 5초 Grace Period | PASS | PASS |
| 16개 동시 요청 중 1개 성공 | PASS | FAIL |
| 실패한 15개 요청의 HTTP 401 | PASS | FAIL |
| 경쟁 이후 새 토큰 사용 | PASS | SKIP |
| 동시 요청 5회 반복 | PASS | FAIL |
| 세션 폐기 및 로그아웃 | PASS | PASS |
| **자동 평가** | **14/14** | **10 PASS / 3 FAIL / 1 SKIP** |

No Harness는 모든 평가를 통과한 반면 Harness에서는 동시 요청을 처리하는 부분에서 실패했다.

당시 로그는 아래와 같았다.

```
C06 FAIL
동시 16건; 200=0

C07 FAIL
401=0, 기타=16

C08 SKIP
승자 토큰으로 추가 재발급 불가

C09 FAIL
5회 반복 모두 200=0, 401=0, 기타=16
```

16개의 요청 중 성공한 요청이 하나도 없었고, 심지어는 401 응답도 반환되지 않았다.

## 8. 디버깅

### 8.1 MySQL 사용 여부 확인

우선 애플리케이션이 MySQL에 잘 연결되어 있는지 확인했다.

```
Database JDBC URL
[jdbc:mysql://127.0.0.1:3307/phase3_h]

Database driver: MySQL Connector/J

Database dialect: MySQLDialect
```

MySQL은 잘 사용하고 있는 걸 보면, 동시 요청 처리 과정에서 문제가 발생한 듯 싶었다.

---

### 8.2 커넥션 풀 고갈

서버 로그에서 아래와 같은 오류 로그를 발견했다.

```
HikariPool-1 - Connection is not available,
request timed out after 30005ms

(total=10, active=10, idle=0, waiting=11)
```

DB 커넥션이 모두 사용 중이어서 새로운 트랜잭션을 시작할 수 없는 상황이었다.

실제로 다음 예외도 발생했다.

```
CannotCreateTransactionException:
Could not open JPA EntityManager for transaction
```

여기서 한 가지 의문점이 생겼다.

커넥션이 10개고, 동시에 들어온 요청이 16개라면 처리하지 못하고 실패하는 게 당연한 건가 ??

[!image.png](../../../public/img/gpt-connection-pool.png)

그렇지 않다고 한다.

커넥션 풀의 크기가 동시 HTTP 요청 수보다 작더라도 처리할 수 있다.

먼저 커넥션을 사용한 작업이 끝나면 반환된 커넥션을 다른 요청이 사용할 수 있기 때문이라고 한다.

문제는 커넥션을 보유한 작업들이 오랫동안 완료되지 않는다는 점인 것 같았다.

---

### 8.3 커넥션 풀 고갈 ?

그래서 원인을 좁히기 위해서 커넥션 풀의 크기를 32개로 늘려 보기로 했다.

```markdown
export SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=32
```

그런데 이번에는 전혀 다른 결과가 나타났다.

```
C06 FAIL
동시 16건; 200=12

C07 FAIL
401=4, 기타=0
```

동시 요청 16개 중 12개가 성공했다.

5회 반복한 결과는 다음과 같다.

| 회차 | HTTP 200 | HTTP 401 | 기타 |
| --- | --- | --- | --- |
| 1회 | 12 | 4 | 0 |
| 2회 | 16 | 0 | 0 |
| 3회 | 16 | 0 | 0 |
| 4회 | 16 | 0 | 0 |
| 5회 | 13 | 3 | 0 |

원래 기대했던 것은 200 OK 1번, 401 Unauthorized 15번이었는데 실제로는 최대 16개 요청이 모두 성공했다.

커넥션 풀이 부족해서 오류가 발생하는 현상은 사라졌지만, 그 대신 동일한 Refresh Token을 여러 번 사용할 수 있는 문제를 발견했다.

커넥션 풀을 늘리는 것은 근본적인 동시성 문제의 해결책이 아니었고, 오히려 커넥션 부족으로 가려져 있던 문제가 드러났다.

그렇다면 비관적 락을 사용했는데도 왜 이런 문제가 발생했을까 ?

---

### 8.4 코드 분석 - RefreshTokenService

Harness가 작성한 실제 코드를 살펴봤다.

`RefreshTokenService`의 `rotate`의 핵심 부분이다.

```java
@Transactional
public Optional<TokenResponse> rotate(String rawToken) {

    String tokenHash = hash(rawToken);

    Optional<Long> sessionId =
            tokens.findSessionIdByTokenHash(tokenHash);

    if (sessionId.isEmpty()) {
        return Optional.empty();
    }

    AuthSession session =
            sessions.lockById(sessionId.get()).orElseThrow();

    RefreshToken token =
            tokens.findByTokenHash(tokenHash).orElseThrow();

    // 이후 만료 여부 및 회전 여부 검증
    // 새 Refresh Token 발급
    // 이전 Refresh Token 회전 처리
}
```

처리 순서를 보면 아래와 같다.

1. Refresh Token의 해시값을 계산한다.
2. 해시값으로 Session ID를 조회한다.
3. Session 행에 비관적 락을 획득한다.
4. Refresh Token을 다시 조회한다.
5. 회전 여부를 확인하고 새로운 토큰을 발급한다.

3번 단계를 보면 실제로 비관적 락이 사용되고 있었다.

---

### 8.5 AuthSessionRepository

```java
public interface AuthSessionRepository
        extends JpaRepository<AuthSession, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select s
        from AuthSession s
        where s.id = :id
        """)
    Optional<AuthSession> lockById(
            @Param("id") Long id
    );
}
```

`PESSIMISTIC_WRITE` 는 데이터베이스의 쓰기 잠금을 활용하는 방식이라고 한다.

MySQL InnoDB에서는 일반적으로 `SELECT ... FOR UPDATE`와 같은 잠금 조회로 이어지기 때문에 의도는 이해됐다.

같은 세션에 대한 요청이 동시에 발생하면, 세션 행을 잠궈서 한 번에 하나의 트랜잭션만 진행하도록 하려는 것 같았다.

---

### 8.6 RefreshTokenRepository

```java
public interface RefreshTokenRepository
        extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(
            String tokenHash
    );

    @Query("""
        select t.session.id
        from RefreshToken t
        where t.tokenHash = :hash
        """)
    Optional<Long> findSessionIdByTokenHash(
            @Param("hash") String hash
    );
}
```

`findSessionIdByTokenHash()`와 `findByTokenHash()`는 일반적인 비잠금 조회이다.

즉 세션에는 비관적 락을 걸었지만, Refresh Token 자체를 다시 조회할 때는 일반 `SELECT`를 사용하고 있었다.

여기서 MySQL의 트랜잭션 격리 수준이 중요해진다.

---

## 9. MySQL의 REPEATABLE READ와 스냅샷

### 9.1 트랜잭션 격리 수준

트랜잭션의 격리 수준은 여러 트랜잭션이 동시에 실행될 때 서로의 데이터 변경을 어느 정도까지 볼 수 있는지를 정의한다.

대표적으로 다음 네 가지가 있다.

| 격리 수준 | 특징 |
| --- | --- |
| READ UNCOMMITTED | 아직 커밋되지 않은 변경도 읽을 수 있음 |
| READ COMMITTED | 커밋된 데이터만 읽음 |
| REPEATABLE READ | 동일 트랜잭션의 반복 조회에서 일관된 읽기 제공 |
| SERIALIZABLE | 더 강한 직렬화 보장을 제공 |

MySQL InnoDB의 기본 트랜잭션 격리 수준은 `REPEATABLE READ`이다.

### 9.2 Consistent Read와 Locking Read

`REPEATABLE READ`에서는 일반적인 `SELECT`가 일관된 읽기로 동작할 수 있다.

쉽게 말하면 트랜잭션이 만들어둔 스냅샷을 기준으로 데이터를 조회하는 방식이다.

반면 `SELECT ... FOR UPDATE`와 같은 잠금 조회는 잠금 읽기로 동작한다.

잠금 조회는 일반적인 스냅샷 조회와 달리, 현재 상태를 기준으로 행을 읽고 잠금을 획득한다.

이 두 방식이 한 트랜잭션 안에 섞여 있으면 주의해야 한다.

### 9.3 예시 상황

다시 Harness 코드의 순서를 보자.

1. `findSessionIdByTokenHash()` : 일반 SELECT → 여기서 스냅샷 생성
2. `lockById()`: 락 대기 (이 사이에 다른 요청이 회전을 커밋)
3. `findByTokenHash()`: 일반 SELECT → 1번에서 만든 스냅샷을 읽음

두 요청 A와 B가 동일한 Refresh Token으로 재발급을 시도한다고 가정해보자.

```markdown
   요청 A                          요청 B
     |                              |
     v                              v
Session 락 획득                Session 락 대기
     |                              |
     v                              |
  Token A 회전                       |
     |                              |
     v                              |
  COMMIT                            |
     |                              |
     +----------------------------->|
                                    v
                              Session 락 획득
                                    |
                                    v
                              Token A 재조회
                                    |
                                    v
                              rotated = true
                                    |
                                    v
                                 HTTP 401
```

요청 B는 Session 행에 대한 락을 정상적으로 획득했지만, 락을 잡기 전에 이미 스냅샷이 만들어져 있었다.

그래서 락을 잡은 뒤의 일반 SELECT에서도 이전 스냅샷의 토큰 상태(`rotated=false`)를 읽게 된다.

결국 이미 회전된 토큰을 아직 회전되지 않은 것으로 판단하고 새 토큰을 발급한다.

락을 걸었다는 사실이, 락 획득 이후 조회하는 데이터가 최신 상태라는 걸 보장해주는 것은 아니다.

다만 이 다이어그램은 관찰된 실패를 설명할 수 있는 실행 순서이고, 실제 요청별 SQL 실행 시각을 추적해서 재현한 건 아니다.

그래도 MySQL의 읽기 동작과 실제 메서드 호출 순서가 맞아떨어지고, 바로 뒤에 할 격리 수준 변경 실험이 이 설명을 뒷받침해준다.

그렇다면 트랜잭션 격리 수준을 바꾸면 어떻게 될까 ?

---

## 10. READ COMMITED로 변경

앞서 커넥션 풀을 32개로 늘렸을 때는 여러 요청이 동시에 성공했다.

이번에는 커넥션 풀은 32개로 유지하고, 트랜잭션 격리 수준만 `READ COMMITED`로 변경해봤다.

```bash
export SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=32

export SPRING_DATASOURCE_HIKARI_TRANSACTION_ISOLATION=TRANSACTION_READ_COMMITTED
```

그리고 동일한 평가를 다시 실행했다.

```bash
python3 ../experiment-results/phase3_eval.py \
  --base-url http://localhost:8080 \
  --workers 16 \
  --rounds 5 \
  --out ../experiment-results/phase3-mysql-read-committed.csv
```

### 10.1 평가 결과

```
C06 PASS
동시 16건; 200=1

C07 PASS
401=15, 기타=0

C08 PASS
승자 토큰으로 추가 재발급

C09 PASS
5회 반복 모두 동일한 결과
```

결과가 기댓값과 같아졌다. (200 1회, 401 15회)

아래는 반복 테스트 결과이다.

| 회차 | HTTP 200 | HTTP 401 | 성공 세션 유지 |
| --- | --- | --- | --- |
| 1회 | 1 | 15 | 성공 |
| 2회 | 1 | 15 | 성공 |
| 3회 | 1 | 15 | 성공 |
| 4회 | 1 | 15 | 성공 |
| 5회 | 1 | 15 | 성공 |

평가를 모두 통과했다.

### 10.2 문제가 사라진 이유

`READ COMMITED`에서는 일반적인 일관된 읽기가 문장 단위로 새로운 스냅샷을 사용할 수 있다.

따라서 다른 트랜잭션이 토큰 회전을 커밋한 뒤 다시 조회한다면, 최신 회전 상태를 확인할 수 있게 된다.

---

## 11. REPEATABLE READ 유지하는 방법

격리 수준을 `READ COMMITED`로 변경하는 것만이 해결 방법은 아니다.

현재 코드에서는 Session에만 잠금 조회를 적용하고 있는데,

그렇다면 Refresh Token 자체를 재조회할 때에도 잠금 읽기를 사용하면 어떨까 ?

예를 들면, `RefreshTokenRepository`에 아래와 같은 메서드를 추가할 수 있다.

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("""
    select t
    from RefreshToken t
    where t.tokenHash = :hash
    """)
Optional<RefreshToken> findByTokenHashForUpdate(
        @Param("hash") String hash
);
```

그리고 기존 코드는 다음과 같이 변경하면 된다.

```java
// 기존 코드
RefreshToken token =
        tokens.findByTokenHash(tokenHash)
                .orElseThrow();
                

// 변경 후 코드
RefreshToken token = tokens.findByTokenHashForUpdate(tokenHash)
															.orElseThrow();
```

변경 후에는 Session에 대한 락을 획득 후 Refresh Token도 잠금 조회한다.

잠금 조회는 스냅샷이 아니라 현재 상태를 읽기 때문에, 일반적인 스냅샷 조회에 의존하는 문제를 피할 수 있을 것으로 예상된다.

다만, 락을 추가할 때는 다음 사항도 고려해야 한다.

- Session과 Refresh Token의 잠금 획득 순서가 일관적인지
- 다른 서비스에서는 반대 순서로 락을 획득하진 않는지
- 서로 다른 트랜잭션이 교착 상태에 빠질 가능성은 없는지
- 불필요한 잠금으로 처리량이 감소하지는 않는지

참고로 위 수정안은 실제로 적용해보지 않았기 때문에 검증된 결과가 아니다.

---

## 12. REQUIRES_NEW와 커넥션 풀

코드를 분석하면서 추가로 눈에 띄는 부분이 있었는데 바로 `RotationCommitRecorder` 이다.

### 12.1 RotationCommitRecorder

Harness는 Refresh Token 회전이 실제로 커밋된 시점을 기록하려고 한다.

`RefreshTokenService`에는 다음 코드가 있다.

```java
if (time.requiresPostCommitTimestamp()) {

    TransactionSynchronizationManager
            .registerSynchronization(
                new TransactionSynchronization() {

                    @Override
                    public void afterCommit() {
                        commitRecorder.record(tokenHash);
                    }
                }
            );
}
```

`afterCommit()`은 트랜잭션이 성공적으로 커밋된 뒤 호출되는 콜백이다.

그리고 `RotationCommitRecorder`는 다음과 같다.

```java
@Service
public class RotationCommitRecorder {

    private final RefreshTokenRepository tokens;
    private final RefreshTokenTime time;

    public RotationCommitRecorder(
            RefreshTokenRepository tokens,
            RefreshTokenTime time
    ) {
        this.tokens = tokens;
        this.time = time;
    }

    @Transactional(
        propagation = Propagation.REQUIRES_NEW
    )
    public void record(String tokenHash) {

        if (tokens.recordCommittedRotation(
                tokenHash,
                time.now()
        ) != 1) {

            throw new IllegalStateException(
                "Committed rotation token missing"
            );
        }
    }
}
```

여기서 `REQUIRES_NEW`가 중요하다.

### 12.2 REQUIRES_NEW란 ?

`REQUIRES_NEW`는 스프링에서 기존 트랜잭션과 별개의 트랜잭션을 시작하도록 하는 전파 옵션이다.

외부 트랜잭션과 내부 트랜잭션은 서로 독립적인 커밋 및 롤백 경계를 가진다.

일반적인 JDBC 트랜잭션 환경에서는 기존 트랜잭션이 자원을 보유한 상태에서 새 트랜잭션을 위한 추가 커넥션이 필요할 수도 있다.

이번 코드의 구조를 단순하게 표현하면 다음과 같다.

```
RefreshTokenService.rotate()
            |
            v
     기본 트랜잭션 시작
            |
            v 
      토큰 조회 및 회전
            |
            v 
         COMMIT
            |
            v
      afterCommit()
            |
            v 
RotationCommitRecorder.record()
            |
            v
   REQUIRES_NEW 트랜잭션
            |
            v
    회전 완료 시각 기록
            |
            v
         COMMIT
```

스프링의 `afterCommit()` 이 호출되는 시점에는 트랜잭션 커밋이 완료됐더라도 관련 자원 정리가 아직 끝나지 않았을 수 있다.

따라서 새 트랜잭션이 추가 커넥션을 확보해야 하는 상황이 생길 수 있다.

### 12.3 커넥션 풀 고갈과의 관계

동시에 여러 요청이 기존 커넥션을 보유하면서 새로운 트랜잭션을 시작하려고 한다면, 커넥션 풀 고갈이 발생할 수 있다.

```
요청 A ── 커넥션 1 확보 ── 추가 커넥션 대기
요청 B ── 커넥션 2 확보 ── 추가 커넥션 대기
요청 C ── 커넥션 3 확보 ── 추가 커넥션 대기

...

요청 J ── 커넥션 10 확보 ── 추가 커넥션 대기

남은 커넥션 = 0
```

특히 이런 구조를 의심할 수 있는데, 이처럼 커넥션 풀이 고갈된 상태에서 각 작업이 추가 커넥션을 기다리면 진행이 멈출 수 있다.

---

## 13. 추가적인 문제

`RotationCommitRecorder`를 분석하면서 하나 더 생각해 볼 부분이 있는데

바로, Refresh Token 회전과 회전 완료 시각 기록이 서로 다른 트랜잭션에서 처리된다는 점이다.

```
트랜잭션 A
    |
    v
Refresh Token 회전
    |
    v
COMMIT 성공
    |
    v
트랜잭션 B
    |
    v
회전 완료 시각 기록
    |
    v
COMMIT
```

그런데 트랜잭션 A는 정상적으로 커밋됐지만, 트랜잭션 B가 실패한다면 어떻게 될까 ?

```
Refresh Token 회전
        |
        v
   COMMIT 성공
        |
        v
회전 완료 시각 기록 시도
        |
        v
       실패
```

이 경우 토큰은 이미 회전됐지만, 회전 시각이 정상적으로 기록되지 않을 수 있다.

MySQL에서는 `requiresPostCommitTimestamp()`가 `true`이기 때문에

먼저 `rotatedAt`에 `null`을 전달한 뒤, 커밋 이후 별도 트랜잭션으로 시각을 기록한다.

그런데 별도 시각 기록에 실패한 경우를 생각해보자.

```java
Instant committedAt =
        time.committedRotationAt(
                tokenHash,
                token.getRotatedAt()
        );

if (committedAt != null
        && now.isAfter(
                committedAt.plusSeconds(5)
        )) {

    session.revoke();
}
```

재사용 탐지에는 위와 같은 조건이 있다.

만약 `rotatedAt`이 계속 `null`로 남는다면, 5초를 초과했더라도 세션 폐기 조건이 달성되지 않을 수 있다.

---

## 14. 결과 종합

지금까지 진행한 MySQL 평가를 모두 정리하면 다음과 같다.

| 환경 | No Harness | Harness |
| --- | --- | --- |
| MySQL 초기 설정 | 14/14 | 10/14 |
| MySQL, Pool 32 | 미실시 | 10/14 |
| MySQL, Pool 32, READ COMMITTED 설정 | 미실시 | 14/14 |

Harness의 동시 요청 결과만 따로 정리하면 다음과 같다.

| 환경 | HTTP 200 | HTTP 401 | 결과 |
| --- | --- | --- | --- |
| Pool 10, 기본 격리 수준 | 0 | 0 | 커넥션 획득 타임아웃 |
| Pool 32, 기본 격리 수준 | 12~16 | 0~4 | 중복 재발급 |
| Pool 32, READ COMMITTED 설정 | 1 | 15 | 기대 결과 충족 |

이 실험을 통해서 확인할 수 있었던 것은 다음과 같다.

1. 커넥션 풀의 크기를 늘리는 것만으로 동시성 문제가 해결되는 것이 아니다.
2. 비관적 락을 사용했다고 해서 반드시 올바른 동시성 제어가 보장되는 것은 아니다.
3. 같은 JPA 코드라도 데이터베이스의 트랜잭션 격리 수준에 따라 다른 결과가 발생할 수 있다.

특히 세 번째 내용이 이번 실험에서 가장 크게 배운 부분이고, 흥미로웠던 부분이었다.

---

## 15. 마치며

처음엔 단순히 하네스 엔지니어링을 공부하고 싶었고, 하네스 엔지니어링을 적용하면 더 좋은 코드가 나오는지가 궁금해서 시작했던 실험이었다.

1차, 2차에서는 하네스 엔지니어링을 적용한 쪽이 더 많은 토큰을 사용하는 대신

`Evaluator`가 구현 과정에서 문제를 발견해주는, 에이전트끼리 서로 협업해서 작업하는 게 신기했다.

AI를 이렇게 활용할 수도 있구나 하고.

그런데 3차 실험에선 좀 달랐다.

Harness는 훨씬 많은 토큰과 시간을 사용했지만 최초 평가에서 더 좋은 점수를 받지 못했고, MySQL을 연결하자 예상하지 못했던 동시성 문제가 드러났다.

하네스 엔지니어링에 대한 개념이나 사용법을 배웠다기보다 오히려 스프링과 데이터베이스에 대해서 더 깊은 개념을 공부하게 돼서 떨떠름하면서도 재밌었다.

특히 인상적이었던 부분은 비관적 락을 사용했다는 사실만으로 동시성 문제가 해결되는 것이 아니라는 점이다.

어떤 데이터를 먼저 읽고, 어느 시점에 락을 획득하고, 이후에 어떤 조회를 하는지가 모두 중요했다.

그리고 더 흥미로웠던 건, `Evaluator`만 문제를 놓친 게 아니라 내가 직접 준비한 외부 평가 스크립트도 처음에는 똑같이 놓쳤다는 것이다.

아무튼, 

> **지금까지의 실험을 통해서 하네스 엔지니어링이 반드시 더 좋은 코드를 만들어주는 건 아니지만, 필요하다.**
> 

라는 게 내 결론이다.

사실 이번 실험만 보면 필요하다, 쓸모없다 이 둘 중 하나의 결론엔 도달할 수 없다.

`Evaluator`를 둔다고 해서 모든 문제가 발견되는 건 아니고, 더 많은 토큰을 사용한다고 해서 코드의 정확성이 완벽하게 보장되는 것도 아니다.

그리고 요즘은 AI에 하네스가 자체적으로 구축되어 있어서 사용자가 프롬프트만 보내도 에이전트가 알아서 다 한다고도 하지 않는가 ?

사실상 no-harness와 harness는 기본 하네스와 커스텀 하네스의 비교 실험이었다고 볼 수 있다.

하지만 하네스 엔지니어링은 앞으로도 필요하다고 생각한다.

AI가 실수하지 않는다는 법은 없으니까.

다만 하네스를 직접 구축하기보다는, 이미 제공되고 있는 하네스를 어떻게 보완할 것인지를 더 깊게 고민해봐야 한다고 생각한다.

AI에게 일을 시키는 절차를 만드는 것에서, AI의 결과를 검증할 수 있는 환경을 만드는 것이 중요해질 것 같다.

3차 실험을 진행하고 나서 더더욱 중요하게 느껴지는 것 같다.

`Evaluator`가 있었고 테스트도 진행했지만 동시성 문제가 발생했듯이 AI가 도출해낸 결과에도 실수나 오류가 포함될 수밖에 없다.

만약 내가 다음에 프롬프트로 지시를 내린다면

> 구현 후 반드시 Evaluator 서브 에이전트를 실행해서 코드를 리뷰할 것
> 

에서

> Refresh Token 관련 코드를 변경했다면 반드시 MySQL x.x 환경에서 동시 재발급 테스트를 실행해. 동일 토큰으로 n개의 요청이 들어왔을 때 정확히 하나만 성공해야 하며, 실패하거나 테스트를 실행하지 못했다면 완료를 보고하지 마.
> 

이런 식으로 내릴 것 같다.

AI의 사고 과정을 세세하게 통제하기보다는, AI가 충족해야 하는 조건을 더욱더 명확하게 만드는 식으로 ,,

어차피 사고는 AI가 훨씬x9999999 더 잘하니까 ,,

앞으로 스프링부트 플젝에 하네스를 적용한다면

```
project/
├── AGENTS.md
├── docs/
│   ├── architecture.md
│   └── coding-conventions.md
├── scripts/
│   └── verify.sh
└── src/
    ├── ...
```

나라면 이정도만 구축할 거 같다.

제법 시간이 오래 걸리긴 했지만, 재밌는 연구였고 실험이었고 공부였다.
