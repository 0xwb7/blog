---
title: "하네스 엔지니어링이란"
description: "하네스 엔지니어링에 대해 공부하고 정리한 글입니다."
pubDate: 2026-10-06
category: AI
tags:
  - AI
  - 하네스 엔지니어링
  - Harness
draft: false
---

## 하네스 엔지니어링

하네스 엔지니어링(Harness Engineering)이란 모델 자체를 바꾸지 않고, 모델을 둘러싼 환경, 도구, 컨텍스트, 상태, 검증, 권한, 피드백 루프를 설계하여 AI 에이전트가 장시간 안정적으로 일을 완수할 수 있도록 만드는 엔지니어링이다.

Langchain은 이를 매우 간단하게 `Agent = Model + Harness`라고 표현하고 있다.

여기서 모델이 아닌 실행 시스템의 거의 대부분 (`system prompt, tools, filesystem, sandbox, ochestration, hooks, memory` 등)이 하네스에 속한다.

---

## Harness

원래 `harness`는 말 같은 동물을 제어하기 위한 **마구, 장치**라는 뜻이 있다.

이는 AI에서도 비슷하다.

LLM 자체는 본질적으로 이런 함수에 가깝다.

```
입력
 ↓
LLM
 ↓
출력
```

이렇게, 모델은 입력을 받고 다음 출력을 생성한다.

그런데 우리가 원하는 답변은 보통 이것보다 훨씬 복잡하다.

예를 들어,

> “이 Spring Boot 프로젝트의 로그인 Race Condition을 분석하고 수정해줘.”
> 

라는 요청이 들어오면 AI는 다음을 해야 한다.

```
프로젝트 구조 확인
↓
관련 코드 검색
↓
코드 읽기
↓
원인 분석
↓
수정
↓
테스트 작성
↓
테스트 실행
↓
실패하면 다시 분석
↓
수정
↓
전체 테스트
↓
diff 검토
↓
완료 여부 판단
```

하지만 LLM 자체에는 파일을 읽는 기술도 없고, `./gradlew test`같이 테스트를 실행하는 기술도 없으며, `git diff`를 확인하는 기술도 없다.

그래서 모델 주변에 시스템이 필요하다.

```
                 ┌──────────────┐
                 │    User      │
                 └──────┬───────┘
                        ↓
            ┌───────────────────────┐
            │      Agent Harness    │
            │-----------------------│
            │ Context               │
            │ Prompt                │
            │ Memory                │
            │ Planning              │
            │ Tools                 │
            │ Permissions           │
            │ Sandbox               │
            │ Verification          │
            │ Observability         │
            └──────────┬────────────┘
                       ↓
                  ┌─────────┐
                  │   LLM   │
                  └─────────┘
```

즉, `Model`을 `실제로 일을 수행할 수 있는 Agent`로 만드는 시스템이 `Harness`이다.

---

## 왜 갑자기 하네스 엔지니어링이 중요해졌을까 ?

초기의 LLM 사용법은 거의 이랬다.

```
사용자 → Prompt → LLM → 답변
```

그러다, “더 좋은 프롬프트를 작성하면 더 좋은 답변을 얻을 수 있다.”는 것을 알고, 프롬프트 엔지니어링이 유행했다.

그런데 AI가 Agent가 되면서 상황이 달라졌다.

이제 AI는 단순히 답변만 하는 것이 아닌

```
읽고
생각하고
파일을 수정하고
명령을 실행하고
웹을 보고
API를 호출하고
테스트하고
다시 수정하고
몇 시간 동안 계속 일한다.
```

와 같은 행위를 한다.

그러면 문제의 중심이

```
어떻게 말을 잘 시킬까 ?
```

에서

```
어떤 환경에서 일하게 할까 ?

무엇을 볼 수 있게 할까 ?

어떤 도구를 줄까 ?

무엇을 못하게 할까 ?

실수를 어떻게 발견하게 할까 ?

실수했을 때 어떻게 복구하게 할까 ?

언제 작업이 끝났다고 판단할까 ?
```

로 이동한다.

이것이 하네스 엔지니어링이 등장한 배경이다.

실제로 LangChain은 같은 `GPT-5.2-Codex`모델을 그대로 유지하고 하네스만 수정하여

Terminal Bench 2.0 점수를 52.8점 → 66.5점으로 올렸다고 보고한 바가 있다.

모델을 교체한 것이 아니라 `system prompt, tools, middleware, verification`등을 수정한 결과이다.

이 사례가 상당히 중요한데, 이는 `Agent 성능 ≠ Model 성능`라는 뜻이기 때문이다.

---

## 그렇다면, 프롬프트 엔지니어링과는 뭐가 다른가 ?

분야별 핵심질문은 아래와 같다.

| 분야 | 핵심 질문 |
| --- | --- |
| Prompt Engineering | 모델에게 어떻게 지시할 것인가 ? |
| Context Engineering | 모델에게 무엇을 보여줄 것인가 ? |
| Tool Engineering | 모델에게 어떤 행동 능력을 줄 것인가 ? |
| Harness Engineering | 모델이 일하는 전체 시스템을 어떻게 설계할 것인가 ? |
| Agent Engineering | Agent 자체와 주변 시스템을 포괄적으로 어떻게 만들 것인가 ? |
| LLMOps | 이를 어떻게 배포, 관찰, 평가, 운영할 것인가 ? |

예를 들어, `"테스트를 반드시 실행해."`라고 쓰는 건 프롬프트 엔지니어링이다.

하지만 하네스 엔지니어링은 여기서 멈추지 않고

```
./gradlew test
```

라는 `tool`을 제공하고,

```
test exit code != 0
→ 완료 불가능
```

이라는 규칙을 만들고,

CI에서도

```
test 실패
→ merge 불가능
```

하도록 만든다.

즉, 

```
Prompt:
테스트해 주세요.
```

보다

```
System:
테스트가 성공하지 않으면 완료 상태로 전환할 수 없음.
```

를 만드는 것이 하네스 엔지니어링다운 접근이다.

---

## Context Engineering과 Harness Engineering의 관계

`Context Engineering`은 `Harness Engineering`에서 굉장히 중요한 부분집합이다.

앤트로픽은 `Context Engineering`을

> 모델 inference 시점에 들어가는 제한된 토큰들을 가장 유용하도록 구성하는 문제
> 

라고 설명하고 있다.

프롬프트뿐만 아니라 `system instruction, tools, MCP, external data, message history` 등이 모두 `context`에 포함된다.

예를 들어 코딩 에이전트에

```
AGENTS.md
README.md
ARCHITECTURE.md
전체 프로젝트 코드
Git history
모든 이슈
모든 PR
모든 API 문서
모든 로그
```

를 한꺼번에 넣으면 좋아 보이지만, 오히려 성능을 떨어뜨릴 수 있다.

Context는 무한하지 않기 때문이다.

`100개의 중요한 정보`+`900개의 불필요한 정보` 를 넣어버리면 모델이 무엇에 집중해야 하는지 애매해진다.

앤트로픽은 이를 포함해, `context`가 길어질수록 관련 정보를 제대로 활용하는 능력이 떨어질 수 있는 현상을 설명한다. (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

그래서 중요해진 원칙이 바로 “모든 것을 넣지 말고, 필요한 것을 필요한 순간에 넣어라”고 말하는 `Progressive Disclosure`이다.

---

## Progressive Disclosure

우리가 `Harness`를 구성하면서 가장 많이 하는 실수가 바로 `CLAUDE.md`나 `AGENTS.md`에 모든 규칙을 때려 넣는 행동이다.

예를 들어 아래와 같은 내용을 `AGENTS.md`에 추가한다고 해보자.

```
프로젝트 구조 설명
JPA 규칙
테스트 규칙
API 규칙
Git 규칙
Controller 규칙
Service 규칙
Repository 규칙
Exception 규칙
DTO 규칙
Security 규칙
Docker 규칙
AWS 규칙
...
```

대충 10,000줄짜리 `AGENTS.md`가 만들어진다. 이러면 당연히 좋지 않다.

OpenAI에서도 실제 프로젝트에서 처음에는 방대한 내용이 담긴 `AGENTS.md` 를 사용했지만,

`context`낭비, 지침 충돌, 문서 부패 등의 문제 때문에 실패했다고 한다.

대신 약 100줄 정도의 `AGENTS.md`를 백과사전이 아닌 목차처럼 사용하고, 실제 지식은 구조화된 `docs/`에 저장하는 방식으로 변경했다. (https://openai.com/ko-KR/index/harness-engineering/)

예를 들어 구조는 아래와 같이 구성하고,

```
AGENTS.md
ARCHITECTURE.md

docs/
├── architecture/
│   ├── domain-rules.md
│   └── dependency-rules.md
│
├── backend/
│   ├── jpa.md
│   ├── exception.md
│   └── api-design.md
│
├── security/
│   └── auth.md
│
├── testing/
│   └── verification.md
│
└── product/
    ├── feature-spec.md
    └── requirements.md
```

`AGENTS.md`는 아래와 같이 작성한다.

```
Architecture 변경:
→ docs/architecture/

JPA 작업:
→ docs/backend/jpa.md

Security 작업:
→ docs/security/auth.md

작업 완료 전:
→ docs/testing/verification.md
```

이렇게 하게 되면 에이전트가 해당 작업이 필요할 때만 해당하는 `md`를 읽는다.

이게 바로 `Progressive Disclosure`이다. (단계적 공개)

---

## Harness의 핵심 구성 요소

실무에서 `Harness`를 볼 때, 다음 10개의 층으로 보면 거의 모든 구조가 설명된다고 한다.

1. **Instruction Layer**
    - `system prompt, AGENTS.md, CLAUDE.md, coding rules, skills`처럼 “어떻게 행동해야 하는가”를 알려준다.
2. **Context Layer**
    - 현재 task, 관련 코드, 문서, Git history, memory 등 이번 추론에 필요한 정보를 고른다.
3. **Tool Layer**
    - `filesystem, shell, Git, browser, database, API, MCP` 등을 통해 `Agent`가 실제 행동할 수 있게 한다.
4. **Environment Layer**
    - `repository, container, dependency, dev server, test DB` 같은 실제 작업 환경을 구성한다.
5. **State & Memory Layer**
    - `task` 상태, 이전 작업, 결정사항, `progress` 등을 `context window` 밖에 영속화한다.
6. **Orchestration Layer**
    - `model → tool → observation → model loop, subagent 호출, planner/generator/evaluator 흐름` 등을 제어한다.
7. **Verification Layer**
    - `test, lint, type checking, static analysis, UI test, evaluator` 등을 통해 결과를 검증한다.
8. **Policy & Security Layer**
    - `filesystem/network 권한, secret 접근, destructive action approval` 등 행동 범위를 제한한다.
9. **Observability Layer**
    - `trace, token, tool calls, latency, cost, error` 등을 기록해 `Agent`가 왜 실패했는지 관찰한다.
10. **Evaluation Layer**
    - 실제 `task` 집합을 반복 실행해 `harness` 변경이 성능을 개선했는지 측정한다.

---

## 기본적인 Agent Loop

`Agent`의 본질은 엄청 복잡하진 않다. 코드로 보면 대충 아래와 같다.

```java
while (!done) {
    Context context = contextBuilder.build(state);
    ModelResponse response = model.generate(context);

    if (response.hasToolCall()) {
        ToolCall call = response.getToolCall();
        policy.check(call);
        
        ToolResult result = toolExecutor.execute(call);
        state.add(result);
    } else {
        VerificationResult verification = verifier.verify(response, state);

        if (verification.isPassed()) {
            done = true;
        } else {
            state.addFeedback(verification);
        }
    }
}
```

개념적으로 보면

```
              ┌───────────────────┐
              │   Context Build   │
              └─────────┬─────────┘
                        ↓
                   ┌─────────┐
                   │  Model  │
                   └────┬────┘
                        ↓
                ┌──────────────┐
                │  Action 선택  │
                └───────┬──────┘
                        ↓
                    Tool 실행
                        ↓
                   Observation
                        ↓
                  State 업데이트
                        ↓
                  Verification
                        │
                  실패   │  성공
                   ↓    │    ↓
                  반복   │   종료
```

이것이 `Harness`의 핵심 루프이다.

---

## 여기서 중요한 건 Model이 아닌 Loop !!

AI를 처음 쓰는 초보자는 이렇게 생각하기 쉽다.

```
GPT를 더 좋은 모델로 바꾸면 해결되겠지 ?
```

물론 모델 성능은 중요하다.

하지만 `Agent`시스템에서는 아래와 같은 현상이 자주 발생한다.

```
좋은 모델 + 나쁜 Harness = 나쁜 Agent
```

반대로

```
적절한 모델 + 좋은 Harness = 상당히 좋은 Agent
```

도 가능하다.

왜냐하면 `Agent`의 실수는 단순히 멍청해서 발생하는 것이 아니기 때문이다.

따라서 하네스 엔지니어링은 “상위 모델이 왜 이것도 못하지 ?” 라고 생각하기 보단

“이 실패를 다시 발생하지 않게 하려면 어떤 `capability`나 `feedback`이 필요한가 ?”

라고 생각한다.

이 사고방식이 하네스 엔지니어링의 핵심 중 하나이다.

---

## Feed-forward와 Feedback

### Feed-forward

`Feed-forward`는 과거의 결과나 오류를 수정하는 '피드백'과 달리, 미래의 행동이나 목표를 향해 개선 방향을 미리 제시하고 안내하는 개념이다.

즉, `Agent`가 행동하기 전에 주는 정보이다.

예시를 들면 아래와 같이 볼 수 있다.

```
AGENTS.md
Architecture guide
Coding conventions
API spec
Skills
Tool descriptions
Example code
Product requirements
```

쉽게 말하면 “… 해줘.” 라고 말해주는 거라고 보면 된다.

반대로 `Feedback`은 행동 이후에 말해주는 것이다.

```
Agent가 코드 생성
        ↓
test
lint
compiler
type checker
runtime
browser
logs
metrics
evaluator
        ↓
문제 발견
        ↓
Agent에게 결과 전달
        ↓
수정
```

---

## 말로 부탁할 수 있는 것을 코드로 강제하라.

예를 들어 “Controller에서 Repository를 직접 호출하지 마.” 라는 문구를 `AGENTS.md`에 작성했다.

하지만 `Agent`는 이를 가끔 어긴다.

그래서 더 좋은 `Harness`는

```
Controller
   ↓
Service
   ↓
Repository
```

라는 `dependency rule` 을 정하고, `ArchUnit`같은 `structural test`로 검사한다.

```java
noClasses()
    .that().resideInAPackage("..controller..")
    .should().dependOnClassesThat()
    .resideInAPackage("..repository..");
```

이렇게 하면, `Agent`가 잘못 작성했을 때

```
Architecture test FAILED

Controller must not depend on Repository directly.
Use Service layer.
```

가 나온다.

이렇게 되면 “자연어 규칙”이 “실행 가능한 `invariant`가 되는 것이다.

---

## 가드레일과 검증

`Guardrail`과 `Verification`은 다르다.

`Guardrail`은 하면 안 되는 행동을 막는다. (`rm -rf /, drop database`같이 무시무시한 것들)

`Verification`은 결과가 올바른지 검사한다. (테스트같은 것들)

`Evaluator`는 결과의 품질을 판단한다. (요구사항에 맞는지)

따라서 `Harness`에는 보통 세 축이 존재한다.

```
Policy
   → 해도 되는가?

Verification
   → 맞게 동작하는가?

Evaluation
   → 충분히 잘 만들었는가?
```

## Deterministic check와 LLM Evaluator

가능하면 객관적인 문제는 deterministic하게 검사해야 한다.

```
컴파일 되는가?
→ compiler

테스트 통과했는가?
→ test runner

코드 formatting이 맞는가?
→ formatter

dependency rule을 지켰는가?
→ architecture test
```

이런 걸 굳이 AI에게 “컴파일 될 것 같아 ?” 라고 물어볼 필요가 없다.

반면 아래와 같은 질문들은 deterministic하게 검사하기 어렵다

```
API가 이해하기 쉬운가?

UI가 전문적으로 보이는가?

이 abstraction이 지나치게 복잡하지 않은가?
```

이럴 땐 `LLM evaluator`가 유용하다.

좋은 `Harness`에서는 보통 `Deterministic verification + LLM evaluation`을 섞는다.

---

## Generator가 자기 코드를 평가하게 하면 안 될까 ?

가능은 하다. 하지만 꽤 큰 문제가 있다.

AI가 본인이 작성한 코드를 자신이 평가하게 되면, 자기 작업에 관대해지는 경향이 있다고 한다.

그래서 `Generator`와 `Evaluator`를 분리했다.

즉, 

```
Planner
   ↓
Generator
   ↓
Evaluator
   ↓
feedback
   ↓
Generator
```

이런 구조이다.

---

## 왜 Fresh Context Evaluator가 강력할까

`Evaluator`가 `Generator`의 대화 내용을 전부 보게 되면 이런 문제가 발생할 수 있다.

```
Generator:

이 구조가 가장 합리적이라고 판단했습니다.
A 때문에 B 방식을 선택했습니다.
```

`Evaluator`도 `Generator`가 B 방식을 선택한 이유 A를 읽으면 `anchoring`될 수 있다.

그래서 평가 `Agent`에게는

“Generator의 reasoning” 보단

“요구사항+실제 결과물+평가 기준”

을 주는 편이 좋다.

---

## Tool Engineering

`Harness`의 성능에 가장 큰 영향을 미치는 부분 중 하나이다.

예를 들어 `Agent`에게 이런 `tools`가 있다고 가정해보자.

```
readFile
writeFile
searchFile
bash
git
browser
```

Tool 설계가 이상하면 좋은 모델도 tool을 잘 못 쓴다.

예를 들어 `getUser(user)`보다 `getUserById(userId)`가 훨씬 명확하다.

그리고 `listAllUsers()`로 많은 수의 유저를 반환하는 것은 `Agent`에게 매우 나쁘다.

반환값도 `context token`을 소비하기 때문이다.

더 좋은 tool은 `searchUsers(query, limit)`같은 형태이다.

앤트로픽도 `Agent tool` 설계에서 명확한 목적, `namespacing`, `token-efficient response`, 명확한 `input/output schema`, 좋은 `tool description` 등을 중요한 원칙으로 강조한다.

또한 너무 많은 중복 tool도 Agent를 혼란스럽게 만들 수 있다고 지적한다. (https://www.anthropic.com/engineering/writing-tools-for-agents?_bhlid=034a77614e0eb86338163a52740c89c5ddf8f102)

---

## State와 Memory

`Agent`의 가장 근본적인 제약 중 하나가 `context window`이다.

예를 들어 `Agent`가 6시간 동안 개발을 한다고 하자.

그동안 수백 번의 tool 호출이 발생하면 모든 내용을 계속 `context`에 넣을 순 없다.

따라서 `Harness`는아래 예시처럼 상태를 밖으로 꺼내야 한다.

```
progress.md
task.json
git history
database
artifact
memory store
filesystem
```

이걸 `Externalized State`라고 보면 된다.

---

## Long-running Agent

앤트로픽은 `Long-running Agent`의 핵심 문제를 아래와 같이 비유했다.

```
8시간마다 개발자가 퇴근하고
새 개발자가 들어오는데
이전 개발자가 기억을 전혀 전달하지 않는 상황
```

그래서 필요한 것이 `handoff`이다.

예:

```
Agent Session #1
     ↓
progress artifact
git commit
task state
     ↓
Agent Session #2
```

---

## Completion Condition

`Completion Condition`은 완료 판단을 `Agent`에만맡기면 안 된다.

나쁜 구조 예시:

```
Agent:
"끝났어?"

Agent:
"네."
```

좋은 구조:

```
isDone =
    buildSuccess
    && testsPassed
    && lintPassed
    && acceptanceCriteriaPassed
    && evaluatorApproved;
```

즉,

> 완료는 느낌이 아니라 상태여야 한다.
> 

가 중점이다.

---

## Context Compaction과 Context Reset

작업이 길어지면 `context`가 가득 차게 된다.

이를 해결하기 위해서 일반적으로 두 가지 방법이 있다.

### Compaction

```
기존 Context
↓
요약
↓
계속 같은 session
```

장점은 연속성(`continuity`)가 높다는 점이다.

하지만 요약 과정에서 정보의 손실 우려가 있다.

### Reset

```
Session A
↓
handoff artifact 생성
↓
Context 완전히 제거
↓
Session B
```

앤트로픽은 일부 `long-running task`에서 `reset + structured handoff`가 `compaction`만 사용하는 것보다 더 안정적이었다고 보고했다.

새로운 `Agent`가 깨끗한 `context`에서 시작하기 때문이다. (https://www.anthropic.com/engineering/harness-design-long-running-apps?trk=public_post_comment-text)

## Doom Loop

코딩 에이전트를 오래 돌리다보면 아래와 같은 상황이 종종 있다.

```
수정
↓
에러
↓
비슷하게 수정
↓
에러
↓
다시 수정
↓
에러
↓
같은 접근 반복
```

이를 `doom loop`라고 부르는데, `Harness`가 이를 감지할 수 있다.

예를 들어 같은 파일 8번 이상 수정하게 되면 `middleware`가 

```
You've modified this file repeatedly.
Stop and reconsider the current approach.
Re-read the original requirement.
```

를 넣는다.

여기서 중요한 건, “`Agent`가 언젠가 알아서 깨닫겠지” 가 아닌,

“`Harness`가 `failure pattern`을 관찰한다.”는 것이다.

---

## Observability

프로그램이 실패하면 `stack trace`를 남긴다.

마찬가지로 `Agent`도 실패하면 아래와 같은 현상이 나타나고,

```
왜 저 tool을 썼지?

왜 저 파일을 안 읽었지?

왜 테스트를 안 했지?

왜 계속 같은 방법을 썼지?

Context에 어떤 정보가 있었지?
```

이를 `trace`로 남긴다.

```
Prompt
↓
Model output
↓
Tool call
↓
Tool result
↓
Model output
↓
Tool call
...
```

아래의 내용도 함께 기록한다.

```
token usage
latency
cost
tool errors
verification result
final result
```

하네스 엔지니어링은 이 `trace`를 디버깅한다. 

---

## Security

`Agent`는 단순 챗봇보다 훨씬 많은 것에 접근이 가능하기 때문에 위험한 환경이 있다.

그래서 `Agent`에게 “위험한 행동은 하지 마.” 라고 말하는 것은 `security`로 볼 수 없다.

진짜 `security`는 시스템 레벨에서 해야 한다.

---

## Sandbox

예를 들어, `Agent`가 `/project`에만 접근이 가능하다고 가정해보자.

그리고 `~/.ssh, ~/.aws, /etc`등은 접근 할 수 없게 하고,

네트워크도 `github.com, repo.maven.apache.org` 만 허용하게 한다.

이게 바로 `Sandbox` 이다.

---

## Least Privilege

`Agent`에게 필요한 최소 권한만 주는 것이다.

```
Read source code       ✅
Modify project code    ✅
Run tests              ✅

Read ~/.ssh            ❌
Access production DB   ❌
Force push main        ❌
Delete GitHub repo     ❌
```

그리고 중요한 action은 approval gate를 둔다.

```
read source
→ auto allow

run tests
→ auto allow

delete project
→ deny

deploy production
→ human approval
```

이렇게 해야 자율성과 안전성을 동시에 확보할 수 있다.

---

## Harness는 자율성을 높인다 ?

지금까지의 설명을 보면 `Harness`로 `Agent`의 목줄을 단단히 채워서 자율성을 떨어뜨리는 걸로 보이지만, 실상은 그렇지 않다.

오히려 `Agent`의 자율성을 높인다.

나쁜 시스템:

```
Agent 행동
→ 매번 사용자 승인
```

좋은 시스템:

```
Sandbox 내부
→ 자유롭게 행동

Boundary 밖
→ 차단 / 승인
```

즉,

엄청나게 넓은 운동장에서 감시하면서 행동을 제한하는 것보다

좁고 안전한 운동장에만 있다면 자유롭게 뛰어놀 수 있게 하는 게 좋다는 것이다.

---

## Multi-Agent Harness

이 방법을 사용하면 `Agent`하나가 모든 역할을 수행하지 않아도 된다.

구조 예시를 들자면 다음과 같다.

```
             Planner
                │
      ┌─────────┴─────────┐
      ↓                   ↓
 Backend Agent      Frontend Agent
      │                   │
      └─────────┬─────────┘
                ↓
             Reviewer
                ↓
             Tester
                ↓
            Evaluator
```

위 구조의 장점은 역할별 `context`가 작아진다는 것이다.

예를 들어 `Backend Agent` 는 백엔드 관련만 보고 UI나 프론트는 볼 필요가 없다.

이것이 `Context Isolation`이다.

---

## 하지만 Agent를 많이 만든다고 좋은 건 아니다

하지만, `Multi-agent` 가 무조건 좋은 것은 아니다.

`Agent`가 많아질수록

```
communication cost
context duplication
coordination
merge conflict
token cost
latency
state synchronization
```

이 증가한다.

그래서 좋은 기준은

> `sub-agent`에게 독립적인 `task`와 `context`를 줄 수 있는가 ?
> 

이다.

만약 그렇다면 분리 가치가 있다.

---

## 실제 Coding Harness를 만들어보자.

스프링부트 프로젝트라면 단순한 초기 `Harness`를 다음과 같이 만들 수 있다.

```
project/
├── AGENTS.md
├── ARCHITECTURE.md
│
├── docs/
│   ├── api.md
│   ├── persistence.md
│   ├── security.md
│   └── verification.md
│
├── scripts/
│   ├── setup.sh
│   ├── verify.sh
│   └── architecture-test.sh
│
├── src/
│
└── build.gradle
```

### AGENTS.md

```
# Project

Spring Boot backend.

Java 21
Spring Boot
PostgreSQL
JPA

# Architecture

See ARCHITECTURE.md.

# Detailed rules

Persistence:
docs/persistence.md

Security:
docs/security.md

API:
docs/api.md

# Verification

Before completing implementation work:

./scripts/verify.sh

must succeed.
```

### verify.sh

```bash
#!/bin/bash

set -e

./gradlew clean check
```

이렇게 작성하면 `Agent`에게 단순히 “테스트해주세요.” 를 넘어

```
작업 완료
→ verify.sh 실행
→ 성공해야 완료
```

라는 `contract`가 된다.

### Architecture Test

여기에 `Architecture Test` 를 추가해보자.

스프링 프로젝트의 invariant 예시:

```
Controller
↓
Service
↓
Repository
```

이를 `ArchUnit`으로 강제한다.

그리고 `Harness`의 `Completion flow`를

```
Implementation
     ↓
Unit Test
     ↓
Integration Test
     ↓
Architecture Test
     ↓
Static Analysis
     ↓
Git Diff Review
     ↓
Evaluator
     ↓
Complete
```

로 만든다.

이러면 단순히 코딩 에이전트를 사용하는 것이 아니라, 코딩 에이전트가 잘 일할 수 있는 환경을 개발하기 시작한 것이다.

---

## Harnessability

최근 중요해진 개념이라고 한다.

무슨 말이냐면

> 이 코드베이스가 `Agent`가 작업하기 좋은 구조인가 ?
> 

를 뜻한다.

예를 들어 아래와 같은 프로젝트는 `Harnessability` 가 낮다.

```
실행 방법 불명확
테스트 없음
문서 없음
implicit convention 많음
global state 많음
dependency 복잡
로그 없음
production과 local 환경 차이 큼
```

반대로 이런 프로젝트는 `Harnessability` 가 높다.

```
한 명령으로 실행
한 명령으로 테스트
clear architecture
rich error message
small modules
good types
docs near code
observable runtime
reproducible environment
```

재밌는 점은 `Harnessability` 가 높으면 코딩 에이전트뿐만 아니라 사람에게도 좋은 개발환경으로 보인다.

---

## Open Loop와 Closed Loop

나쁜 `Agent`:

```
요구사항
↓
코드 생성
↓
끝
```

이건 `Open Loop`이다.

좋은 `Agent`:

```
요구사항
↓
코드 생성
↓
실행
↓
관찰
↓
오류 분석
↓
수정
↓
실행
↓
검증
```

이게 `Closed Loop`이다.

하네스 엔지니어링의 상당 부분은 결국

> LLM 작업을 `open-loop generation`에서 `closed-loop engineering`으로 바꾸는 것
> 

이라고 이해할 수 있을 것 같다.

---

## 그래서, 하네스 엔지니어링이 개발자를 위협하는가 ?

아니다.

오히려 하네스 엔지니어링 덕분에 개발의 기본기가 더 중요해진 것 같다.

`Harness`를 잘 만들기 위해서 알아야 하는 것들이

```
Architecture
Testing
CI/CD
Observability
Security
Operating System
Sandbox
Distributed Systems
Concurrency
API Design
Database
Software Design
Evaluation
```

이런 것들이다.

결국 AI 잘 쓰는 법보다는

> 소프트웨어 시스템을 잘 설계하는 법
> 

에 가까워지고 있는 것 같다.

---

## 결론

하네스 엔지니어링을 한 문장으로 요약하자면

> 모델에게 정답을 잘 생성하라고 부탁하는 것이 아니라, 모델이 정답에 도달할 수밖에 없는 환경과 `feedback loop` 를 잘 설계하는 것
> 

이라고 할 수 있을 것 같다.

---

나는 평소에 `AGENTS.md` 하나의 파일에 모든 지침과 요구사항을 다 넣어놓고 있었는데, 

이번에 하네스 엔지니어링에 대해서 정리하면서 `AGENTS.md` 는 목차처럼 사용하고

실제 지식은 구조화된 폴더를 별도로 두어 저장하는 방법도 있다는 걸 알게 되었다.

항상 가장 최신 모델을 사용하려고 해서 토큰 사용량이 너무 많았는데

적당한 모델 + 적절한 하네스 를 통해 토큰을 더 효율적으로 사용할 수 있을 것 같다.

정리만 하고 끝내면 의미가 없을 것 같아서, 현재 진행 중인 스프링부트 프로젝트에 직접 적용해보려고 한다.

다음 글에서 같은 모델로 동일한 작업 N개를 하네스 적용 전후에 각각 수행하고

토큰 사용량, 재시도 횟수, 아키텍처 규칙 위반 수를 비교해 실제로 어떤 차이가 생기는지 확인할 것이다.
