---
title: "스프링 핵심 원리 - 기본편, 섹션 4을 듣고"
description: "김영한님의 스프링 핵심 원리 정리를 위한 글입니다."
pubDate: 2026-10-15
category: Java
tags:
  - Java
  - Spring
  - 객체지향
  - SOLID
  - IoC
  - DI
draft: false
---

## 새로운 할인 정책 개발

지난 섹션에서는 회원과 주문 도메인을 설계하고, 역할과 구현을 분리해서 코드를 작성했다.

그리고 마지막에

> **새로운 할인 정책을 추가하고 적용할 때, 기존 코드를 변경하지 않고 확장할 수 있는가 ?**
> 

에 대한 질문이 주어졌었다.

이번 섹션에서는 실제로 새로운 할인 정책을 구현하고 적용하면서 어떤 문제가 발생하는지 확인해보겠다.

---

## 새로운 요구사항

기존 할인 정책은 VIP 회원이라면 주문 금액에 상관없이 1,000원을 할인해주는 고정 금액 할인 방식이었다.

그런데 ~~악덕 기획자~~가 서비스 오픈 직전에 할인 정책을 변경해달라고 요청한다 ,,,

- 기존: VIP 회원은 주문 금액과 상관없이 1,000원 할인
- 변경: VIP 회원은 주문 금액의 10% 할인
- BASIC 회원은 할인을 적용하지 않음

정액 할인에서 정률 할인으로 변경을 해야 한다 ,,

---

## RateDiscountPolicy

다행히 우리는 이전에 `DiscountPolicy`라는 인터페이스를 만들어뒀기 때문에

그 인터페이스를 구현하는 새로운 구현체 클래스를 추가하면 된다.

```java
public class RateDiscountPolicy implements DiscountPolicy {

    private int discountPercent = 10;

    @Override
    public int discount(Member member, int price) {
        if (member.getGrade() == Grade.VIP) {
            return price * discountPercent / 100;
        } else {
            return 0;
        }
    }
}
```

다형성을 활용했기 때문에 기존 할인 정책을 수정하지 않고도 새로운 할인 정책을 추가할 수 있었다.

---

## 테스트 코드 작성

할인 정책은 돈과 관련된 로직이기 때문에, 아무리 간단해 보이는 계산이라도 테스트 코드를 작성해서 검증해야 한다.

```java
class RateDiscountPolicyTest {

    RateDiscountPolicy discountPolicy =
            new RateDiscountPolicy();

    @Test
    @DisplayName("VIP는 10% 할인이 적용되어야 한다.")
    void vip_o() {
        // given
        Member member =
                new Member(1L, "memberVIP", Grade.VIP);

        // when
        int discount = discountPolicy.discount(member, 10000);

        // then
        assertThat(discount).isEqualTo(1000);
    }

    @Test
    @DisplayName("VIP가 아니면 할인이 적용되지 않아야 한다.")
    void vip_x() {
        // given
        Member member =
                new Member(2L, "memberBASIC", Grade.BASIC);

        // when
        int discount = discountPolicy.discount(member, 10000);

        // then
        assertThat(discount).isEqualTo(0);
    }
}
```

위 테스트는 두 가지 상황을 검증한다.

1. VIP 회원이 10,000원을 주문하면 1,000원이 할인되는지
2. BASIC 회원은 할인이 적용되지 않는지

테스트는 모두 통과했다.

여기서 중요한 점은 !!

> **성공하는 테스트뿐만 아니라, 실패하는 테스트도 꼭 작성을 해봐야 한다**
> 

라는 것이다.

---

## 새로운 할인 정책 적용과 문제점

새로운 정률 할인 정책도 구현했고 테스트까지 완료했겠다, 이제 실제로 적용을 해보자.

### 할인 정책 변경

기존 `OrderServiceImpl` 은 아래와 같이 작성되어 있었다.

```java
public class OrderServiceImpl implements OrderService {

    private final DiscountPolicy discountPolicy = new FixDiscountPolicy();
    
    ...
}
```

여기서 기존의 `FixDiscountPolicy`를 `RateDiscountPolicy`로 변경하면 된다.

```java
public class OrderServiceImpl implements OrderService {

    private final DiscountPolicy discountPolicy = new RateDiscountPolicy();
    
    ...
}
```

분명 새로운 할인 정책을 추가하는 건 어렵지 않았는데

실제로 적용하려고 보니까 기존의 `OrderServiceImpl`을 수정해야 한다.

분명 역할과 구현을 분리했고, 다형성도 활용했는데 …. 왜 기존 코드를 수정해야 하는 걸까 ??

여기서 코드를 수정하게 되면 객체지향 설계 원칙 중 두 가지를 위반하게 되는데

바로 **DIP**와 **OCP**이다.

### DIP 위반

[DIP는 의존관계 역전 법칙이다.](/posts/spring_sec2#dip-의존관계-역전-원칙)

쉽게 말하면, **구체화가 아닌 추상화에 의존해야 한다는 원칙**이다.

```java
private final DiscountPolicy discountPolicy = new RateDiscountPolicy();
```

코드를 다시 보면, 변수의 타입은 `DiscountPolicy`라는 인터페이스이다.

그렇기 때문에 추상화에 의존하고 있다고 생각할 수 있지만

오른쪽을 보면 `new RateDiscountPolicy()`라는 코드가 있다.

즉, `OrderServiceImpl`은 `DiscountPolicy`라는 인터페이스(추상)뿐만 아니라

`RateDiscountPolicy` 라는 구체 클래스에도 의존하고 있다.

이전의 `FixDiscountPolicy`를 사용했을 때도 마찬가지였다.

결국 인터페이스를 사용하고 있다고 해서 무조건 DIP를 지키는 건 아니다.

인터페이스에 의존하면서 동시에 구체 클래스에도 의존한다면 DIP를 위반하게 된다.

### OCP 위반

[OCP는 개방-폐쇄 원칙이다.](/posts/spring_sec2#ocp-개방-폐쇄-원칙)

소프트웨어 요소는 확장에는 열려 있으나 변경에는 닫혀 있어야 한다는 원칙이다.

그런데 이번에 할인 정책을 변경하면서 어떤 일이 발생했나 ?

새로운 할인 정책 구현체를 추가하는 것까지는 문제가 없었지만

실제로 적용하려고 하니까 기존 주문 서비스 코드를 변경해야 했다.

새로운 기능을 추가하려면 기존 클라이언트 코드까지 수정해야 하는 것이다 ,,,

따라서 OCP도 위반하고 있다.

---

## 어떻게 해결하지 ?

DIP를 지키려면 구체 클래스에 의존하지 않도록 변경하면 된다.

```java
public class OrderServiceImpl implements OrderService {

    private DiscountPolicy discountPolicy;
    
    ...
}
```

이렇게 하면 `OrderServiceImpl`은 `DiscountPolicy`인터페이스에만 의존한다.

구체 클래스에 대한 코드는 사라져서 이제 DIP를 지킬 수 있게 되었다 !!

근데 하나 문제가 발생하게 되는데 **그럼 어떤 구현 객체를 사용하는 건데 ???**

현재 `discountPolicy`에는 아무 값도 할당되어 있지 않다.

따라서 할인 메서드를 호출하면 NPE가 발생할 것이다.

인터페이스는 할인이라는 기능의 규약을 정의할 뿐이지, 실제 할인 로직을 실행할 객체가 아니기 때문이다.

결국 문제를 해결하기 위해서는 누군가가 실제 구현 객체를 생성하고 서비스에 전달해야 한다.

그건 누가할까 ?

---

## 관심사의 분리

이번에는 코드를 보기 전에 하나의 비유를 생각해보자.

애플리케이션을 하나의 공연이라고 가정해보는 것이다.

### 공연과 배우

로미오와 줄리엣이라는 공연을 한다고 생각해보자. 그 공연에는 당연히 로미오 역할과 줄리엣 역할이 있다.

이를 객체지향 설계에 대입해보면

- 인터페이스: 공연에서의 배역
- 구현 클래스: 배역을 담당하는 배우

로미오라는 역할을 디카프리오가 맡았다고 가정하자.

근데, 디카프리오가 줄리엣 역할을 맡을 배우까지 직접 섭외해야 한다면 어떨까 ?

자신이 맡은 역할을 연기하는 것뿐만 아니라, 다른 배우를 섭외하고 선택하는 책임까지 가지게 된다.

나였으면 때려쳤다 ,, 연기만 하면 되지 내가 왜 섭외까지 해줘야 돼 ??

우리의 기존 코드도 이와 비슷했다.

`OrderServiceImpl`은 주문과 관련된 기능을 실행해야 하는 클래스인데

주문 기능을 실행하는 것뿐만 아니라, 어떤 할인 정책 구현체를 사용할 것인지 직접 선택하고 생성하고 있었다.

주문 서비스가 할인 정책 구현체를 직접 선택하고 있는 것이다.

마치 디카프리오가 줄리엣 역할의 배우를 직접 선택하는 것처럼.

그렇다면 이 책임을 분리하면 되지 않을까 ?

---

## AppConfig의 등장

이를 해결하기 위해 `AppConfig`라는 클래스를 만든다.

`AppConfig`는 애플리케이션의 전체 동작 방식을 구성하기 위한 설정 클래스이다.

주요 역할은 두 가지이다.

1. 애플리케이션에서 사용할 구현 객체 생성
2. 생성한 객체들을 연결

공연으로 비유하자면 공연 기획자의 역할이라고 볼 수 있다.

```java
public class AppConfig {

    public MemberService memberService() {
        return new MemberServiceImpl(
                new MemoryMemberRepository()
        );
    }

    public OrderService orderService() {
        return new OrderServiceImpl(
                new MemoryMemberRepository(),
                new FixDiscountPolicy()
        );
    }
}
```

코드를 보면 `AppConfig`가 직접 구현 객체를 생성하고 있다.

그리고 `MemberServiceImpl`, `OrderServiceImpl`의 생성자에 필요한 객체를 전달한다.

그런데 위 클래스를 사용하려면 기존 클래스도 수정해야 한다.

기존에는 구현 객체를 클래스 내부에서 직접 생성했지만, 이제는 외부에서 전달받아야 하기 때문이다.

### 생성자 주입

먼저 `MemberServiceImpl`을 변경해보자.

```java
public class MemberServiceImpl implements MemberService {

    private final MemberRepository memberRepository;

    public MemberServiceImpl(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @Override
    public void join(Member member) {
        memberRepository.save(member);
    }

    @Override
    public Member findMember(Long memberId) {
        return memberRepository.findById(memberId);
    }
}
```

이전에는 `MemberServiceImpl` 내부에서 `MemoryMemberRepository`를 직접 생성했었는데

이제는 생성자를 통해 `MemberRepository`를 전달받는다.

여기서 중요한 부분이 있는데

바로, **`MemberServiceImpl`은 실제 어떤 구현 객체가 전달되는지 알지 못한다는 점이다.**

`MemoryMemberRepository`가 전달될 수도 있고, 다른 데이터베이스를 사용하는 구현체가 전달될 수도 있다.

그걸 결정하는 건 외부의 `AppConfig`이다.

따라서 `MemberServiceImpl`은 실제 저장소가 어떤 구현 방식인지 고민할 필요가 없다.

단지 `MemberRepository`인터페이스에 정의된 기능을 사용하면 된다.

이제 `OrderServiceImpl`도 동일하게 변경해보자.

```java
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    public OrderServiceImpl(MemberRepository memberRepository, DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }

    @Override
    public Order createOrder(Long memberId, String itemName, int itemPrice) {
        Member member = memberRepository.findById(memberId);

        int discountPrice = discountPolicy.discount(member, itemPrice);

        return new Order(memberId, itemName, itemPrice, discountPrice);
    }
}
```

이제 `OrderServiceImpl` 내부에는 `FixDiscountPolicy`나 `RateDiscountPolicy` 와 같은

구체 클래스에 대한 코드가 없다.

오직 `MemberRepository`, `DiscountPolicy` 인터페이스에만 의존한다.

그리고 어떤 구현 객체가 전달될지는 외부 `AppConfig`가 결정한다.

여기서 하나의 중요한 개념이 등장하는데, 바로 **DI(Dependency Injection)** 이다.

외부에서 객체를 생성하고, 해당 객체를 필요로 하는 다른 객체에 전달하여 의존관계를 연결하는 것이다.

지금은 생성자를 통해 전달했기 때문에 생성자 주입이라고 한다.

---

## AppConfig 실행

이제 `MemberApp`과 `OrderApp`도 `AppConfig`를 사용하도록 변경해야 한다.

기존에는 실행 클래스에서 객체를 직접 생성했는데, 이제는 `AppConfig`에서 객체를 받아오면 된다.

```java
AppConfig appConfig = new AppConfig();

MemberService memberService = appConfig.memberService();

OrderService orderService = appConfig.orderService();
```

클라이언트는 객체를 직접 생성하지 않고, `AppConfig`가 만들어 준 객체를 사용한다.

테스트 코드도 같은 방식으로 변경할 수 있다.

```java
class OrderServiceTest {

    MemberService memberService;
    OrderService orderService;

    @BeforeEach
    void beforeEach() {
        AppConfig appConfig = new AppConfig();

        memberService = appConfig.memberService();
        orderService = appConfig.orderService();
    }
}
```

---

## 관심사의 분리 결과

이렇게 코드를 변경하고 나니, 책임이 명확해졌다.

`AppConfig`는 객체를 생성하고 연결하는 책임을 가지고

`MemberServiceImpl` 은 회원과 관련된 기능을 실행하고

`OrderServiceImpl` 은 주문과 관련된 기능을 실행한다.

기존에는 각 구현 클래스가 자신의 기능을 실행하는 것뿐만 아니라, 필요한 다른 구현 객체를 직접 생성하고 연결하는 책임까지 가지고 있었는데

이제는 이러한 책임을 `AppConfig`로 분리했다.

**클라이언트의 권한은 줄었지만, 오히려 어떤 책임을 가져야 하는지가 더욱 명확해졌다.**

이것이 관심사의 분리라고 제목을 붙인 이유인 것 같다.

---

## AppConfig 리팩토링

이제 `AppConfig`를 만들었다고 해서 모든 문제가 해결된 것일까 ??

기존 `AppConfig` 코드를 다시 살펴보자.

```java
public class AppConfig {

    public MemberService memberService() {
        return new MemberServiceImpl(
                new MemoryMemberRepository()
        );
    }

    public OrderService orderService() {
        return new OrderServiceImpl(
                new MemoryMemberRepository(),
                new FixDiscountPolicy()
        );
    }
}
```

코드를 보면 조금 아쉬운 부분이 있다.

먼저 `new MemoryMemberRepository()`가 중복으로 작성되어 있다.

그리고 이 코드만 보고 애플리케이션에 어떤 역할들이 존재하고

각각 어떤 구현체를 사용하는지 한눈에 파악하기가 어렵다.

우리는 객체지향 설계에서 역할과 구현을 분리하는 것이 중요하다고 배웠다.

그렇다면 애플리케이션의 구성 정보에서도 역할과 구현이 명확하게 드러나도록 만들면 좋지 않을까 ?

### 리팩토링

```java
public class AppConfig {

    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    public OrderService orderService() {
        return new OrderServiceImpl(memberRepository(), discountPolicy());
    }

    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }

    public DiscountPolicy discountPolicy() {
        return new FixDiscountPolicy();
    }
}
```

기존에 중복으로 작성했던 `new MemoryMemberRepository()`를 별도의 메서드로 추출했다. 할인 정책도 마찬가지다.

기존에는 `orderService()`에서 직접 `FixDiscountPolicy`를 생성했지만

이제는 `discountPolicy`메서드가 할인 정책 구현체를 반환하도록 변경했다.

이렇게 변경하니까 메서드의 이름과 반환 타입만 봐도 어떤 역할을 담당하는지 한눈에 알 수 있다.

| 메서드 | 역할 | 구현체 |
| --- | --- | --- |
| `memberService()` | 회원 서비스 | `MemberServiceImpl` |
| `orderService()` | 주문 서비스 | `OrderServiceImpl` |
| `memberRepository()` | 회원 저장소 | `MemoryMemberRepository` |
| `discountPolicy()` | 할인 정책 | `FixDiscountPolicy` |

정리해보면 다음과 같은 장점이 있다.

- 중복된 객체 생성 코드를 제거할 수 있다.
- 역할과 구현을 명확하게 구분할 수 있다.
- 애플리케이션 전체 구성을 쉽게 파악할 수 있다.
- 구현체를 변경할 때 수정해야 하는 위치가 명확해진다.

개인적으로 마지막 부분이 가장 마음에 든다 ㅎㅎ

예를 들어 회원 저장소를 메모리 기반에서 다른 구현체로 변경한다고 가정해보자.

기존에는 `AppConfig`안에 있는 여러 `new MemoryMemberRepository()` 를 찾아서 변경해야 했다.

하지만 이제는 `memberRepository()` 메서드의 구현만 변경하면 된다.

역할과 구현을 분리한 것이 단순히 코드를 보기 좋게 만드는 것에서 끝나는 게 아니라

변경하기 편한 구조를 만든느 데에도 도움이 된다.

---

## 새로운 구조와 할인 정책 적용

다시 처음으로 돌아가보자.

우리가 지금까지 코드를 수정했던 이유가 뭐였지 ?

바로 기존의 정액 할인 정책을 새로운 정률 할인 정책으로 변경하기 위해서였다.

그런데 이전에는 할인 정책을 변경하려면 `OrderServiceImpl` 코드를 직접 수정해야 했는데

지금은 어떨까 ?

### 할인 정책 변경

현재 `AppConfig`에는 다음과 같은 메서드가 있다.

```java
public DiscountPolicy discountPolicy() {
    return new FixDiscountPolicy();
}
```

이 부분을 아래와 같이 변경해보자.

```java
public DiscountPolicy discountPolicy() {
    return new RateDiscountPolicy();
}
```

끝.

`OrderServiceImpl`은 수정하지 않아도 된다.

왜 ? `OrderServiceImpl`은 어떤 할인 정책 구현체가 사용되는지 모르고, `DiscountPolicy`라는 인터페이스에만 의존하고 있기 때문이다.

그리고 실제 구현 객체는 `AppConfig`가 생성해서 전달한다.

이렇게 해서 애플리케이션을 크게 두 개의 영역으로 나눴다.

---

## 사용 영역과 구성 영역

### 사용 영역

실제 애플리케이션의 기능을 실행하는 영역이다.

`MemberServiceImpl`, `OrderServiceImpl` 등이 여기에 해당한다.

### 구성 영역

애플리케이션에서 사용할 구현 객체를 생성하고 연결하는 영역이다.

`AppConfig`가 여기에 해당한다.

새로운 할인 정책을 적용하고 싶으면 구성 영역만 변경하면 되고, 사용 영역에 있는 코드는 수정할 필요가 없다.

기존에는 할인 정책을 변경할 때 주문 서비스 구현체를 직접 수정해야 했지만 이제는 구성 영역에서 구현 객체만 바꿔주면 된다.

따라서 사용 영역은 새로운 구현체로 확장하더라도 기존 코드를 변경하지 않는 구조가 되었다.

이것이 OCP를 지키는 방법이었던 것이다.

물론 모든 코드의 변경이 사라지는 건 아니다.

구체적인 구현 객체를 선택하는 `AppConfig`는 변경해야 한다.

하지만 핵심은 실제 기능을 사용하는 클라이언트 코드를 변경하지 않아도 된다는 것이다.

---

## 좋은 객체 지향 설계의 5가지 원칙 적용

[이전 섹션에서 SOLID, 즉 좋은 객체지향 설계의 5가지 원칙을 공부했다.](/posts/spring_sec2#좋은-객체지향)

이번에는 그중 SRP, DIP, OCP가 실제 코드에 어떻게 적용되었는지 확인해보자.

### SRP - 단일 책임 원칙

SRP는 한 클래스는 하나의 책임만 가져야 한다는 원칙이다.

기존의 `MemberServiceImpl`, `OrderServiceImpl`은 여러 책임을 가지고 있었다.

직접 구현 객체를 생성하고, 연결하고, 실제 기능을 실행하는 책임까지 담당했다.

우리는 이러한 책임을 분리하기 위해 `AppConfig`를 만들었다.

이제는 객체를 생성하고 연결하는 책임은 `AppConfig` 가 담당하고, 클라이언트 객체는 실제 기능을 실행하는 책임만 담당한다.

**관심사를 분리해서 각 클래스의 책임을 명확하게 만든 것이다.**

### DIP - 의존관계 역전 원칙

DIP는 추상화에 의존해야지, 구체화에 의존하면 안 된다는 원칙이다.

기존 `OrderServiceImpl`은 다음과 같은 코드를 가지고 있었다.

```java
private final DiscountPolicy discountPolicy = new FixDiscountPolicy();
```

인터페이스를 사용하고 있지만, 실제 구현 클래스인 `FixDiscountPolicy`에도 의존하고 있다.

그래서 DIP를 위반했고, 위의 내용대로 코드를 변경해서 DIP를 지킬 수 있게 되었다.

여기서 의존성 주입(DI)이 중요한 역할을 했다.

**의존성 주입은 DIP 원칙을 따를 수 있도록 도와주는 방법 중 하나인 것이다.**

### OCP - 개방-폐쇄 원칙

기존에는 새로운 할인 정책을 적용하기 위해 `OrderServiceImpl`의 코드를 변경해야 했다.

하지만 이제는 새로운 할인 정책 구현체를 추가하고 `AppConfig`에서 주입할 객체만 변경하면 된다.

`OrderServiceImpl`은 `DiscountPolicy` 인터페이스에 의존하기 때문에 어떤 구현 객체가 전달되더라도 동일한 방식으로 기능을 실행할 수 있다.

이렇게 해서 새로운 할인 정책으로 확장할 수 있으면서, 기존 클라이언트 코드는 변경하지 않아도 되는 구조가 되었다.

즉, OCP를 지킬 수 있게 되었다.

### 정리

이 세 가지 원칙은 서로 독립적인 것 같지만, 실제로 적용하는 과정에서는 서로 연결되어 있었다.

SRP를 적용하기 위해 객체 생성과 실행 책임을 분리했고,

DIP를 적용하기 위해 클라이언트가 인터페이스에만 의존하도록 변경했으며,

외부에서 구현 객체를 주입하는 구조를 만들어서 OCP도 지킬 수 있게 되었다.

처음 SOLID 개념을 공부할 때는 각각의 원칙을 따로 외웠는데, 실제 코드로 적용해보니 왜 이러한 원칙들이 필요한지 조금 더 이해할 수 있었다.

---

## IoC, DI , 그리고 컨테이너

지금까지는 순수 자바 코드만으로 객체지향 설계 원칙을 적용했는데

이 과정에서 `AppConfig`라는 설정 클래스가 등장했다.

`AppConfig` 가 등장하면서 객체를 생성하고 연결하는 방식이 크게 달라졌다.

이를 이해하기 위해서는 IoC와 DI라는 개념을 알아야 한다.

### IoC - 제어의 역전

```java
public class MemberServiceImpl implements MemberService {

    private final MemberRepository memberRepository =
            new MemoryMemberRepository();
}
```

기존에는 `MemberServiceImpl`이 스스로 필요한 구현 객체를 생성했다.

어떤 구현 객체를 사용할지 결정하고, 그걸 직접 생성하고, 해당 객체의 기능을 호출했다.

즉, 필요한 객체의 생성과 연결을 클라이언트가 직접 제이하고 있었다.

하지만 `AppConfig`가 등장하면서 달라졌다.

`MemberServiceImpl`은 더이상 어떤 구현 객체를 사용할지 결정하지 않고

외부에서 전달받은 객체를 사용해서 자신의 기능만을 실행한다.

```java
public MemberServiceImpl(MemberRepository memberRepository) {
    this.memberRepository = memberRepository;
}
```

객체를 생성하고 연결하는 권한이 외부의 `AppConfig`로 넘어간 것이다.

이처럼 프로그램의 제어 흐름을 직접 제어하는 것이 아니라 외부에서 관리하도록 하는 것을 제어의 역전(IoC)라고 한다.

여기서 중요한 것은 단순히 객체를 외부에서 생성한다는 사실만이 아니라

애플리케이션의 전체 구성과 실행 흐름에 대한 제어 권한이 어디에 있는지가 핵심이다.

기존에는 클라이언트 구현 객체가 필요한 구현 객체를 선택하고 생성했지만,

이제는 `AppConfig`가 어떤 구현 객체를 사용할지 결정한다. 심지어 `OrderServiceImpl`도 마찬가지이다.

서비스 구현체의 입장에서는 자신이 어떤 방식으로 생성되었는지, 어떤 구현체가 주입되었는지 몰라도 된다.

### 프레임워크와 라이브러리

제어의 역전을 이해하면 프레임워크와 라이브러리의 차이도 생각해볼 수 있다.

#### 프레임워크

프레임워크가 내가 작성한 코드의 실행 흐름을 제어하고, 적절한 시점에 코드를 호출한다.

대표적인 예시로는 `JUnit`이 있다. 우리는 테스트 메서드에 `@Test`를 붙인다.

```java
@Test
void test() {
    // 테스트 로직
}
```

하지만 테스트 메서드를 직접 호출하지는 않는다.

`JUnit`이 테스트의 실행 흐름을 관리하면서 필요한 시점에 해당 메서드를 호출한다.

#### 라이브러리

반면 라이브러리는 개발자가 작성한 코드에서 필요할 때 직접 호출해서 사용한다.

즉, 프로그램의 실행 흐름을 개발자의 코드가 제어한다.

그렇다고 단순히 외부에서 제공하는 기능을 사용한다고 해서 모두 프레임워크인 것은 아니었다.

누가 프로그램의 제어 흐름을 담당하는지가 중요한 차이인 것 같다.

### DI - 의존관계 주입

`OrderServiceImpl`을 다시 살펴보자.

```java
public class OrderServiceImpl implements OrderService {

    private final MemberRepository memberRepository;
    private final DiscountPolicy discountPolicy;

    public OrderServiceImpl(MemberRepository memberRepository, DiscountPolicy discountPolicy) {
        this.memberRepository = memberRepository;
        this.discountPolicy = discountPolicy;
    }
}
```

`OrderServiceImpl`은 `MemberRepository`, `DiscountPolicy` 인터페이스에 의존한다.

하지만 실제로 어떤 구현 객체가 사용되는지는 알 수 없다. 이 부분을 이해하려면 의존관계를 두 가지로 나누어 생각해야 하는데

바로 정적인 클래스 의존관계와 동적인 객체 인스턴스 의존관계이다.

```java
private final MemberRepository memberRepository;
private final DiscountPolicy discountPolicy;
```

예를 들어 `OrderServiceImpl` 코드를 보면 `MemberRepository`, `DiscountPolicy` 인터페이스에 의존한다는 사실을 알 수 있다.

이건 코드를 읽어보는 것만으로도 알 수 있지만, 실제로 어떤 구현 객체가 주입될지는 알 수 없다.

`MemoryMemberRepository` 가 주입될 수도 있고, 다른 저장소 구현체가 주입될 수도 있다.

마찬가지로 `FixDiscountPolicy`일 수도 있고, `RateDiscountPolicy` 일 수도 있다.

**정적인 클래스 의존관계만으로는 실제 사용되는 구현 객체를 알 수 없는 것이다.**

### 동적인 객체 인스턴스 의존관계

동적인 객체 인스턴스 의존관계는 애플리케이션 실행 시점에 실제 객체 인스턴스의 참조가 연결되는 관계다.

예를 들어 `AppConfig`를 보자.

```java
public OrderService orderService() {
    return new OrderServiceImpl(memberRepository(), discountPolicy());
}
```

`AppConfig`는 필요한 구현 객체를 생성하고, 생성자를 통해 `OrderServiceImpl`에 전달한다.

이때 `OrderServiceImpl`에는 실제 객체 인스턴스의 참조가 연결되는데, 이것이 동적인 객체 인스턴스 의존관계이다.

정리하자면 아래와 같다.

| 구분 | 정적 의존관계 | 동적 의존관계 |
| --- | --- | --- |
| 기준 | 클래스 | 실제 객체 인스턴스 |
| 확인 시점 | 코드 분석 시 | 실행 시점 |
| 확인할 수 있는 것 | 어떤 타입에 의존하는가 | 실제 어떤 객체가 연결되는가 |
| 예시 | `DiscountPolicy` | `RateDiscountPolicy` 객체 |

이걸 보면 DI의 장점이 무엇인지 명확히 알 수 있다.

정적인 클래스 의존관계를 변경하지 않고도 동적인 객체 인스턴스 의존관계를 변경할 수 있다는 것이다.

`OrderServiceImpl`은 계속 `DiscountPolicy`에 의존한다.

하지만 실제 주입되는 객체는 `FixDiscountPolicy`에서 `RateDiscountPolicy`로 변경할 수 있다.

### IoC 컨테이너와 DI 컨테이너

그렇다면 객체를 생성하고 관리하면서 의존관계를 연결해주는 `AppConfig`와 같은 구성요소를 뭐라 부르면 좋을까 ?

바로 `IoC 컨테이너` 또는 `DI 컨테이너` 라고 한다.

두 용어는 비슷하게 사용되지만, 의존관계 주입에 초점을 맞추어 최근에는 DI 컨테이너라는 용어를 주로 사용한다고 한다.

또한 `Assembler`, `Object Factory` 라고 부르기도 한단다.

여기서 지금까지 구현했던 `AppConfig`가 어떤 역할을 수행하고 있었는지 다시 생각해보면

- 필요한 객체 생성
- 생성한 객체 관리 및 연결
- 클라이언트에 필요한 객체 주입

DI 컨테이너와 같은 역할을 하고 있었다.

그렇다면

> **스프링을 사용하면 이러한 객체 생성과 의존관계 주입을 어떻게 처리할까 ???**
> 

라는 의문이 생긴다.

지금까지는 우리가 직접 `AppConfig`를 작성하고 사용했다.

하지만 스프링에는 이러한 역할을 대신 해주는 컨테이너가 존재한다.

---

## 스프링으로 전환하기

우리는 지금까지 스프링을 사용하지 않고 순수 자바만으로 객체지향 설계 원칙을 적용했다.

다형성, DIP, OCP를 지키기 위해 `AppConfig`를 만들었고, 객체 생성과 의존관계 주입까지 직접 구현했다.

이제 스프링 컨테이너를 사용하도록 변경해보자.

### AppConfig 스프링 기반으로 변경

기존에 작성했던 `AppConfig`에 두 가지 어노테이션을 추가하자.

바로 `@Configuration`와 `@Bean`이다.

```java
@Configuration
public class AppConfig {

    @Bean
    public MemberService memberService() {
        return new MemberServiceImpl(memberRepository());
    }

    @Bean
    public OrderService orderService() {
        return new OrderServiceImpl(memberRepository(), discountPolicy());
    }

    @Bean
    public MemberRepository memberRepository() {
        return new MemoryMemberRepository();
    }

    @Bean
    public DiscountPolicy discountPolicy() {
        return new RateDiscountPolicy();
    }
}
```

기존 코드와 비교해보면 크게 달라진 부분은 없고, 클래스와 각 메서드에 어노테이션을 붙였다.

그렇다면 이 어노테이션은 어떤 역할을 할까 ?

### @Configuration

해당 클래스가 스프링의 설정 정보를 담당하는 클래스라는 것을 나타내는 어노테이션이다.

### @Bean

해당 메서드가 반환하는 객체를 스프링 컨테이너에 빈으로 등록하는 어노테이션이다.

여기서 스프링 빈(Spring Bean)이라는 용어가 등장합니다.

스프링 컨테이너에 등록되어 관리되는 객체를 스프링 빈이라고 한다.

우리가 작성한 `AppConfig`에서는 네 개의 메서드에 `@Bean`을 붙였고,

각 메서드가 반환하는 객체들이 스프링 빈으로 등록된다.

### MemberApp에 스프링 컨테이너 적용

이제 `MemberApp` 을 변경해보자.

기존에는 다음과 같이 `AppConfig`를 직접 생성했지만, 이제는 스프링 컨테이너를 사용하겠다.

```java
ApplicationContext applicationContext =new AnnotationConfigApplicationContext(AppConfig.class);

MemberService memberService = applicationContext.getBean("memberService", MemberService.class);
```

갑자기 코드가 좀 복잡해졌다고 느낄 수도 있는데

`ApplicationContext`는 무엇이고, `AnnotationConfigApplicationContext`는 무엇일까 ?

일단 `ApplicationContext` 는 스프링 컨테이너를 나타내는 인터페이스이다.

`AnnotationConfigApplicationContext` 는 어노테이션 기반 설정 정보를 사용해서 스프링 컨테이너를 생성하는 구현 클래스이다.

```java
new AnnotationConfigApplicationContext(AppConfig.class);
```

이렇게 작성하면 `AppConfig` 를 설정 정보로 사용하는 스프링 컨테이너를 생성한다.

스프링 컨테이너는 `AppConfig`에 정의된 `@Bean` 메서드들을 처리해서 객체를 등록하고 관리한다.

그렇다면 필요한 객체는 어떻게 가져올까 ?

```java
applicationContext.getBean("memberService", MemberService.class);
```

`getBean()` 을 사용하면 스프링 컨테이너에 등록된 빈을 조회할 수 있다.

첫 번째 인자는 빈의 이름, 두 번째 인자는 조회할 빈의 타입이다.

오잉 근데 여기서 `memberService`라는 이름은 갑자기 어디서 왔을까 ??

바로 우리가 작성한 `@Bean` 메서드의 이름이다.

```java
@Bean
public MemberService memberService() {
    return new MemberServiceImpl(memberRepository());
}
```

기본적으로 `@Bean` 메서드의 이름을 스프링 빈의 이름으로 사용한다.

따라서 `memberService`라는 이름으로 등록된 빈을 조회할 수 있다.

### OrderApp에도 적용

`OrderApp`에도 동일하게 적용해주자.

```java
ApplicationContext applicationContext = new AnnotationConfigApplicationContext(AppConfig.class);

MemberService memberService = applicationContext.getBean("memberService", MemberService.class);

OrderService orderService = applicationContext.getBean("orderService", OrderService.class);
```

이후 주문을 생성하는 코드는 기존과 동일하다.

```java
long memberId = 1L;

Member member = new Member(memberId, "memberA", Grade.VIP);

memberService.join(member);

Order order = orderService.createOrder(memberId, "itemA", 10000);

System.out.println("order = " + order);
```

실행 결과도 동일하다.

그런데 우리가 직접 객체를 생성하던 코드가, 스프링 컨테이너를 사용하는 코드로 변경되었다.

여기서 가장 중요한 변화는 무엇일까 ?

### 스프링 컨테이너

앞서 `ApplicationContext`를 스프링 컨테이너라고 했고, 스프링 컨테이너는 우리가 전달한 설정 정보를 바탕으로 객체를 생성하고 관리한다.

이번 예시에서는 `AppConfig`가 설정 정보이다.

```java
@Configuration
public class AppConfig {
    // ...
}
```

스프링 컨테이너가 생성되면 설정 정보를 읽고, `@Bean`이 붙은 메서드들을 처리한다.

그리고 반환된 객체를 스프링 컨테이너에 등록하는데, 이렇게 등록된 객체가 바로 스프링 빈이다.

현재 예시에서는 다음과 같은 빈들이 등록된다.

| 빈 이름 | 반환 타입 |
| --- | --- |
| `memberService` | `MemberService` |
| `orderService` | `OrderService` |
| `memberRepository` | `MemberRepository` |
| `discountPolicy` | `DiscountPolicy` |

설정 클래스인 `AppConfig` 자체도 스프링 컨테이너에서 관리된다.

그리고 필요한 객체는 `applicationContext.getBean()` 을 통해 조회할 수 있다.

### 이전 방식과 비교

#### 기존 방식

```java
AppConfig appConfig = new AppConfig();

MemberService memberService = appConfig.memberService();
```

개발자가 직접 `AppConfig`를 생성하고 필요한 객체를 조회했다.

#### **스프링 컨테이너를 사용하는 방식**

```java
ApplicationContext applicationContext = new AnnotationConfigApplicationContext(AppConfig.class);

MemberService memberService = applicationContext.getBean("memberService", MemberService.class);
```

개발자는 설정 정보를 스프링 컨테이너에 전달하고, 필요한 객체를 스프링 컨테이너에서 조회한다.

이전에는 우리가 직접 객체를 생성하고 의존관계를 연결하는 `AppConfig`를 사용했다면,

이제부터는 스프링 컨테이너가 객체를 관리하도록 변경된 것이다.

참고로 `AppConfig`는 여전히 어떤 구현체를 사용할지 정의하는 설정 정보의 역할을 한다.

스프링 컨테이너를 사용한다고 해서 설정 자체가 사라지는 것은 아니다.

### 스프링 부트 버전에 따른 로그 차이

강의에서는 스프링 컨테이너를 생성하면 내부적으로 빈을 생성하는 로그가 출력된다.

그런데 스프링 부트 3.1 이상에서는 강의와 동일한 로그가 출력되지 않을 수 있다고 한다.

이 경우 `MemberApp`, `OrderApp`처럼 `ApplicationContext`를 직접 생성하는 예제에서는

`src/main/resources/logback.xml`을 만들어 DEBUG 로그를 출력하도록 설정할 수 있다.

```xml
<configuration>
    <appender name="STDOUT"
              class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>
                %d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n
            </pattern>
        </encoder>
    </appender>

    <root level="DEBUG">
        <appender-ref ref="STDOUT"/>
    </root>
</configuration>
```

다만 일반적인 스프링 부트 애플리케이션을 실행할 때는 불필요하게 많은 DEBUG 로그가 출력될 수 있으므로 설정을 제거하거나 로그 레벨을 조정해야 한다.

---

## 그래서 스프링 컨테이너를 사용하면 뭐가 좋지 ??

솔직히 말해서 지금까지 작성한 코드를 비교해보면 오히려 기존 코드가 더 간단해 보인다.

기존에는 `AppConfig`를 생성하고 메서드를 호출하면 끝이었다.

하지만 스프링 컨테이너를 사용하니까 `ApplicationContext`라는 인터페이스가 등장하고

`AnnotationConigApplicationContext`라는 구현 클래스도 등장했다.

객체 하나를 가져오기 위해 `getBean()` 까지 호출해야 한다 ,,

그렇다면 굳이 스프링 컨테이너를 사용해야 하는 이유는 무엇일까 ??

단순히 객체를 생성하고 연결하는 것만 생각하면 직접 만든 `AppConfig` 로도 충분해 보인다.

하지만 실제 애플리케이션에서는 객체를 생성하고 연결하는 것 외에도 다양한 관리가 필요하다.

스프링 컨테이너는 이러한 작업들을 편리하게 처리할 수 있도록 여러 기능을 제공한다고 한다.

이번 섹션에서는 스프링 컨테이너가 객체를 생성하고 관리하며, 의존관계를 연결한다는 것까지 배웠다.

구체적으로 어떤 기능을 제공하고, 왜 직접 만든 `AppConfig` 보다 유용한지에 대해서는 다음 섹션에서 알아보겠다.

---

## 마치며

이번 섹션은 지금까지 들었던 강의 중에서도 꽤 중요한 내용이었던 것 같다.

이전에는 스프링을 사용하면서 의존성 주입을 당연하게만 생각했다.

서비스에서 다른 객체가 필요하면 생성자를 만들어서 스프링이 알아서 주입해주도록 ,,

하지만 왜 이렇게 설계해야 하는지, 스프링이 이러한 기능을 제공하는 이유가 무엇일지에 대해선 깊게 고민해본 적이 없었던 거 같다.

근데 이번 섹션에서

순수 자바 코드로 개발하고, 문제를 맞닥뜨리고, 그걸 해결하기 위해 `AppConfig`도 직접 만들어보고 ,,,

그 과정에서 IoC와 DI의 개념도 다시 한 번 되짚어보고, 마지막엔 그 역할을 스프링 컨테이너가 담당하도록 변경도 해봤다.

**결국 스프링 컨테이너가 왜 등장했는지를 이해하기 위해서 객체지향 설계 원칙부터 하나씩 살펴본 것이다 ,,**

나는 기초부터 탄탄히 쌓아가는 걸 좋아하기 때문에 이런 류의 강의를 정말 좋아하고 재밌게 듣지만

당장 취업에 목말라서 자바와 스프링에 대한 이해도 없이 프로젝트만 기계처럼 뽑아내는 사람들에게는

이런 걸 굳이 왜 배우지 ? 별 도움 안 되는 내용인 것 같은데 ? 라고 생각할 수도 있을 것 같다.

요즘 아무리 모든 개발을 AI에게 맡긴다지만, 이러한 기초 지식이 있어야 결과물의 퀄리티도 더 높아진다고 생각한다.

나만 듣고 싶다. 이 강의
