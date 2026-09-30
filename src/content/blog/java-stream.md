---
title: "고급 Java [2] - 람다식, Stream, Optional"
description: "백엔드 2주차 강의를 위한 강의자료"
pubDate: 2026-09-29
category: Java
tags:
  - Lambda
  - Stream
  - Optional
draft: false
---


## 오늘 배울 코드 미리 보기

다음과 같은 숫자들이 있다고 가정하겠습니다.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);
```

`List.of()` 는 직접 넣은 값을 리스트로 만드는 메서드입니다.

이 리스트는 `add()` , `remove()` , `set()` 으로 수정할 수 없고, `null`도 넣을 수 없습니다.

이때, “짝수만 골라서 각각 10을 곱한 새로운 리스트를 만들어주세요 !!!!!” 라는 요청사항이 있다고 가정해봅시다.

기존의 우리가 알던 방식으로 작성하면 다음과 같습니다.

```java
List<Integer> result = new ArrayList<>();

for (Integer number : numbers) {
    if (number % 2 == 0) {
        result.add(number * 10);
    }
}

System.out.println(result);    // [20, 40, 60]
```

`Stream` 을 사용하면 아래와 같이 작성할 수 있습니다.

```java
List<Integer> result = numbers.stream()
        .filter(number -> number % 2 == 0)
        .map(number -> number * 10)
        .toList();
        
System.out.println(result);    // [20, 40, 60]
```

처음 보면 아래 코드가 더 어렵게 보일 수 있습니다. 오늘 수업으로 이 코드가 자연스럽게 읽히면 좋겠습니다.

실제 백엔드 서비스에서 사용될 수 있는 간단한 예제 코드도 한 번 보겠습니다.

```java
List<User> users = List.of(
        new User(1L, "철수", 20),
        new User(2L, "영희", 23)
);

Long id = 2L;

User user = users.stream()
        .filter(u -> u.getId().equals(id))
        .findFirst()
        .orElseThrow(
                () -> new IllegalArgumentException("사용자를 찾을 수 없습니다.")
        );
```

아직은 코드 전체를 이해할 필요 없이 흐름만 이해하시면 될 거 같습니다.

유저 정보가 있고, 거기서 조건에 맞는 id를 가진 유저를 검색하고, 없는 경우 처리까지 할 수 있다는 흐름만 봐두시면 됩니다.

---

## 인터페이스

람다를 이해하려면 인터페이스부터 잠깐 짚고 넘어가야 합니다.

인터페이스는 **어떤 기능을 제공해야 하는지 정해놓은 규격**이라고 이해하시면 편합니다.

### 인터페이스와 구현체

두 숫자를 계산하는 인터페이스를 만들어보겠습니다.

```java
public interface Calc {

    int calc(int a, int b);
}
```

`calc()`는 두 개의 `int`를 입력 받고, 하나의 `int`를 반환합니다.

하지만 아직 더할지, 뺄지는 정해진 게 없습니다.

이렇게 어떻게 실행할지 정해지지 않은 채로 선언된 메서드를 **추상 메서드**라고 합니다.

실제로 더하는 코드는 구현체에서 작성합니다.

```java
public class AddCalc implements Calc {
    
    @Override
    public int calc(int a, int b) {
        return a + b;
    }
}
```

`implements Calc`는 `Calc`의 규격을 구현하겠다는 뜻입니다.

`@Override`는 메서드를 재정의하겠다는 뜻입니다.

### 함수형 인터페이스

앞의 `Calc`에는 구현해야 하는 추상 메서드가 하나뿐입니다. (`calc`)

이처럼 추상 메서드가 하나뿐인 인터페이스를 **함수형 인터페이스**라고 합니다.

기존 `Calc.java`에 다음과 같이 어노테이션을 붙여보겠습니다.

```java
@FunctionalInterface
public interface Calc {
    
    int calc(int a, int b);
}
```

`@FunctionalInterface`가 없어도 조건을 만족하면 함수형 인터페이스입니다.

해당 어노테이션을 붙이면 컴파일러가 그 조건에 맞는지 검사해줍니다.

다음은 의도적으로 컴파일 오류를 낸 예제입니다.

```java
@FunctionalInterface
public interface Calc {

    int calc(int a, int b);
    
    int anotherCalc(int a, int b);    // 컴파일 에러 !!!
}
```

추상 메서드가 하나가 아닌 두 개라서 오류가 납니다.

어노테이션을 지우면 일반 인터페이스로 사용할 수 있지만, 람다로 구현할 수 있는 함수형 인터페이스는 아닙니다!

정확히는, 상속받은 메서드까지 고려해 구현해야 할 추상 메서드가 하나인지 판단하는데, 이 부분은 개인적으로 더 공부하고 싶은 분들만 찾아보시길 바랍니다.    Java 17 함수형 인터페이스 공식 문서

### 그래서 추상 메서드가 하나면 뭐가 다른데요 ???

구현할 메서드가 하나면, 메서드 이름을 다시 적지 않아도 어떤 메서드의 구현인지 알 수 있습니다.

하나밖에 없으니깐요 !

그래서 함수형 인터페이스는 람다식으로 구현할 수 있습니다.

근데 람다로 넘어가기 전에, 클래스를 조금 더 짧게 만드는 방법부터 보겠습니다.

---

## 익명 클래스

앞에서 덧셈 하나를 위해 `AddCalc`라는 클래스를 따로 만들었습니다.

이 클래스가 여러 곳에서 재사용된다면 아주 좋습니다. 그런데 딱 한 곳에서만 두 숫자를 더하려는 경우에는

이렇게 별도의 클래스까지 만드는 것이 비효율적이겠죠 ?

이때, 아래와 같이 작성할 수 있습니다.

```java
Calc c = new Calc() {
    
    @Override
    public int calc(int a, int b) {
        return a + b;
    }
};

System.out.println(c.calc(10, 20));    // 30
```

이것이 익명 클래스입니다. 별도의 클래스를 만들지 않고 그 자리에서 인터페이스를 구현하는 방식입니다.

### 그래서 핵심 로직은 어디에 ?

클래스 파일은 줄었지만, 여전히 코드가 꽤 깁니다.

실제로 하고 싶은 일은 `return a + b` 한 줄 뿐인데도요.

그럼 이제 본격적으로 람다식에 대해서 알아보도록 하겠습니다.

---

## 람다식이 필요한 이유

조금 전 익명 클래스를 다음 한 줄로 바꿀 수 있습니다.

```java
Calc c = (a, b) -> a + b;

int result = c.calc(10, 20);

System.out.println(result);    // 30
```

람다식이란, **함수형 인터페이스의 하나뿐인 추상 메서드 구현을 간단하게 표현하는 방법** 입니다.

그렇다면 왜 `int`나 `calc`를 적지 않아도 될까요 ?

`Calc`를 보면 구현해야 할 메서드가 `int calc(int a, int b)` 하나뿐이기 때문에

컴파일러가 입력과 반환 타입을 알 수 있기 때문입니다.

---

## 람다 기본 문법

기본적인 형태는 다음과 같습니다.

```
(매개변수) -> 실행할 코드
```

왼쪽은 입력, 오른쪽은 그 입력으로 할 일 이라고 이해하시면 됩니다.

### 매개변수가 없는 경우

```java
() -> System.out.println("Hello World!")
```

### 매개변수가 하나인 경우

```java
(name) -> System.out.println(name)
```

### 매개변수가 여러 개인 경우

```java
Calc c1 = (a, b) -> a + b;
Calc c2 = (int a, int b) -> a + b;    // 타입을 직접 적는 것도 가능
```

### 실행문이 여러 줄인 경우

여러 문장을 실행하려면 중괄호를 사용하면 됩니다.

```java
Calc c = (a, b) -> {
    int result = a + b;
    System.out.println(result);
    return result;
};

c.calc(10, 20);    // 30
```

### 표현식 하나로 반환하는 경우

```java
Calc c1 = (a, b) -> {
    return a + b;
};

Calc c2 = (a, b) -> a + b;
```

### 외부 변수를 사용하는 경우

```java
int min = 20;

Predicate<Integer> isAdult = age -> age >= min;

System.out.println(isAdult.test(25));    // true
```

이때 `min`은 초기화 후 다시 할당되지 않는 지역변수여야 합니다.

만약 뒤에서 `min = 25;` 처럼 다시 할당하게 되면 컴파일 오류가 납니다.

---

## Java 표준 함수형 인터페이스

조건 검사, 출력, 변환을 할 때마다 `Checker, Printer, Converter, Generator`같은 인터페이스를 직접 만들면 번거로워집니다.

자바는 자주 쓰는 형태를 `java.util.function` 패키지에서 미리 제공하고 있습니다.

| 인터페이스 | 입력 | 출력 | 용도 |
| --- | --- | --- | --- |
| Predicate<T> | T | boolean | 조건 검사 |
| Function<T, R> | T | R | 값을 다른 값으로 변환 |
| Consumer<T> | T | void | 값을 받아 작업 수행 |
| Supplier<T> | 없음 | T | 값을 생성하거나 제공해서 반환 |

무엇을 받고 무엇을 반환하는지를 보시면 됩니다.

`T, R`은 타입 매개변수이고, `void`는 반환값이 없다는 뜻입니다.

### Predicate

어떤 값이 조건에 맞는지 판단하고 싶을 때 사용합니다. 값을 하나 받고, `boolean`으로 반환합니다.

```java
Predicate<Integer> isAdult = age -> age >= 20;

boolean result = isAdult.test(25);

System.out.println(result);              // true
System.out.println(isAdult.test(17));    // false
```

`Predicate`의 대표 메서드는 **`test()`** 입니다.

`test(25)`가 람다의 `age`에 25를 전달하고, `25 ≥ 20`의 결과를 반환합니다.

### Function

문자열을 길이로 바꾸거나, 사용자 객체에서 이름을 꺼내고 싶을 때 사용합니다.

```java
Function<String, Integer> length = str -> str.length();

int result = length.apply("hello");

System.out.println(result);    // 5
```

대표 메서드는 `apply()`입니다. 앞의 `String`은 입력 타입, 뒤의 `Integer` 는 출력 타입입니다.

### Consumer

값으로 작업은 하되, 결과값을 반환할 필요가 없을 때 사용합니다.

출력이 대표적인 예시입니다.

```java
Consumer<String> printer = name -> System.out.println(name);

printer.accept("이우빈");    // 이우빈
```

대표 메서드는 `accept()`입니다.

### Supplier

필요한 시점에 값을 만들어주거나 제공하는 동작을 전달하고 싶을 때 사용합니다.

```java
Supplier<Double> random = () -> Math.random();

double value = random.get();

System.out.println(value);
```

대표 메서드는 `get()`입니다.

정리하자면 다음과 같습니다.

| 필요한 동작 | 사용할 형태 | 직접 호출할 메서드 | 사용처 |
| --- | --- | --- | --- |
| 조건에 맞는지 확인 | Predicate<T> | test() | filter(),
anyMatch(),
allMatch() |
| 어떤 값으로 바꿀 것인지 | Function<T, R> | apply() | map() |
| 이 값으로 무슨 작업을 할 건지 | Consumer<T> | accept() | forEach(),
ifPresent() |
| 필요할 때 무엇을 제공할 건지 | Supplier<T> | get() | orElseGet(),
orElseThrow() |

나중에 `Stream` 을 사용할 때 매번 `test()`나 `apply()` 를 직접 적어서 사용하는 게 아니라

우리가 동작을 전달하면 `Stream`쪽에서 필요한 시점에 알아서 사용합니다.

---

## 메서드 참조

앞에서 만든 출력 람다를 다시 보겠습니다.

```java
Consumer<String> printer = name -> System.out.println(name);
```

받은 값을 그대로 기존 메서드에 전달하고 있습니다. 이 코드를 다음과 같이 줄일 수 있습니다.

```java
Consumer<String> printer = System.out::println;

printer.accept("이우빈");    // 이우빈
```

이것을 메서드 참조라고 합니다. `::` 으로 이미 있는 메서드를 가리킵니다.

### 리스트에 적용하기

```java
List<String> names = List.of("김석환", "박연지", "이우빈");

names.forEach(
        name -> System.out.println(name)
);
```

위 코드를 메서드 참조로 바꾸면 다음과 같습니다.

```java
List<String> names = List.of("김석환", "박연지", "이우빈");

names.forEach(System.out::println);

/*
출력:

김석환
박연지
이우빈
*/
```

여기서는 리스트의 `forEach()`를 바로 호출했습니다.

뒤에서는 `Stream`의 `forEach()`도 보게 될 텐데, 둘 다 각 값을 `Consumer`로 받습니다.

---

## Stream이 필요한 이유

이제 미리보기에서 봤던 처음의 요구사항으로 돌아가보겠습니다.

짝수만 골라서 10을 곱하는 코드입니다.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);
List<Integer> result = new ArrayList<>();

for (Integer number : numbers) {
    if (number % 2 == 0) {
        result.add(number * 10);
    }
}
```

이 반복문은 잘못된 코드가 아닙니다. 지금처럼 단순한 작업엔 적합한 코드라고 볼 수 있습니다.

하지만 여기에 정렬, 중복 제거, 리스트의 일부만 가져오기 등등 여러 기능이 추가되면

결과 리스트와 처리 순서를 직접 관리할 일이 늘어나게 됩니다.

`Stream`은 컬렉션 등의 데이터를 여러 처리 단계로 연결해서 가공할 수 있도록 제공되는 `API`입니다.

위 코드를 아래와 같이 단순화할 수 있습니다.

```java
List<Integer> result = numbers.stream()
        .filter(number -> number % 2 == 0)
        .map(number -> number * 10)
        .toList();

/*
numbers에서
짝수만 filter하고
각 10을 곱하고
List로 변환한다

라고 이해하시면 됩니다. 쉽죠?
*/
```

여기에 조금 전에 배운 두 형태가 들어가있습니다.

```java
number -> number % 2 == 0    // Integer -> boolean    Predicate

number -> number * 10        // Integer -> Integer    Function
```

결국 우리가 람다를 먼저 배운 이유는 `Stream`에 넘겨줄 조건과 변환 동작을 람다로 작성하기 위해서였습니다.

## Stream 기본 구조

`Stream`은 데이터 소스에서 어떤 처리를 할지 연결하는 흐름입니다.

```
데이터 소스: numbers
    ↓
Stream 생성: stream()
    ↓
중간 연산: filter()
    ↓
중간 연산: map()
    ↓
최종 연산: toList()
```

실제 코드의 역할을 표시하면 다음과 같습니다.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);

List<Integer> result = numbers.stream()     // 생성
        .filter(number -> number % 2 == 0)  // 중간 연산
        .map(number -> number * 10)         // 중간 연산
        .toList();                          // 최종 연산
```

중간 연산은 다음 작업을 이어갈 수 있도록 `Stream`을 반환합니다.

최종 연산은 `List`, 개수, 검색 결과 등을 리턴하거나 출력하면서 처리를 끝냅니다.

중간 연산은 여러 개일 수도 있고, 없을 수도 있습니다.

`Stream`의 데이터 처리는 최종 연산을 시작할 때 필요한 만큼 진행됩니다.

중간 연산을 적는 즉시 모든 요소를 처리하는 것은 아닙니다.

위 내용을 더 자세히 알고 싶으면 → Java 17 Stream 공식 문서

## Stream 중간 연산

중간 연산을 하나씩 보겠습니다.

아래 예제들은 결과를 확인하기 위해 마지막에 `toList()` 를 붙였습니다.

### filter - 조건에 맞는 값만 남기기

전체 데이터에서 필요한 데이터만 고르고 싶을 때 사용합니다.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);

List<Integer> result = numbers.stream()
        .filter(number -> number % 2 == 0)
        .toList();
        
System.out.println(result);
```

true를 반환한 요소만 다음 단계로 넘깁니다.

조건은 `Integer -> boolean` 이므로 `Predicate<Integer>`에 해당합니다.

따로 선언해서 전달하는 방식도 가능합니다.

```java
Predicate<Integer> isEven = number -> number % 2 == 0;

List<Integer> result = numbers.stream()
        .filter(isEven)
        .toList();
```

### map - 값을 다른 값으로 변환

각 값을 가공하거나 객체에서 필요한 정보를 꺼낼 때 사용합니다.

```java
List<Integer> numbers = List.of(1, 2, 3);

List<Integer> result = numbers.stream()
        .map(number -> number * 10)
        .toList();

System.out.println(result);
```

`Integer -> Integer` 이므로 `Function<Integer, Integer>` 형태입니다.

`filter()`와 달리 값을 선택하는 게 아니라 변환합니다.

객체에서도 같습니다.

```java
List<User> users = List.of(
        new User(1L, "석환", 24),
        new User(2L, "연지", 24),
        new User(3L, "우빈", 26)
);

List<String> names = users.stream()
        .map(user -> user.getName())
        .toList();

System.out.println(names);
```

위 코드는 `User -> String`입니다. 따라서 `Function<User, String>`에 해당합니다.

아래와 같이 메소드 참조를 적용할 수도 있습니다.

```java
List<String> names = users.stream()
        .map(User::getName)
        .toList();
```

### sorted - 정렬

숫자를 작은 순서대로 보고 싶다면 정렬 단계를 추가할 수 있습니다.

```java
List<Integer> numbers = List.of(5, 1, 4, 2, 3);

List<Integer> result = numbers.stream()
        .sorted()
        .toList();

System.out.println(result); 
```

인자가 없는 `sorted()`는 요소의 기본 정렬 순서를 사용합니다. (오름차순)

### distinct - 중복 제거

값이 중복될 때, 중복을 제거할 수 있습니다.

```java
List<Integer> numbers = List.of(1, 1, 2, 2, 3, 3);

List<Integer> result = numbers.stream()
        .distinct()
        .toList();

System.out.println(result);
```

### limit - 원하는 개수만 가져오기

목록의 앞부분만 필요할 때 사용합니다.

```java
List<Integer> numbers = List.of(5, 1, 4, 2, 3);

List<Integer> result = numbers.stream()
        .limit(3)
        .toList();

System.out.println(result);
```

### 여러 연산 연결하기

이제 조건 검사, 변환, 정렬, 개수 제한을 연결해보겠습니다.

```java
List<Integer> numbers = List.of(8, 3, 2, 6, 4, 1);

List<Integer> result = numbers.stream()
        .filter(number -> number % 2 == 0)
        .map(number -> number * 10)
        .sorted()
        .limit(3)
        .toList();

System.out.println(result);
```

## Stream 최종 연산

데이터를 가공했다면, 마지막엔 무엇을 얻고 싶은지 정해야 합니다.

`List`가 필요한지, 개수만 필요한지, 존재 여부만 알면 되는지에 따라 최종 연산이 달라집니다.

이 챕터의 숫자 예제는 아래 데이터를 사용하겠습니다.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);
```

### toList - List로 만들기

위에서 많이 봤으니 이제 잘 알고 계시죠 ?

결과를 모아서 리스트로 전달하고 싶을 때 사용합니다.

```java
List<Integer> result = numbers.stream()
        .filter(number -> number >= 3)
        .toList();

System.out.println(result);
```

이때, `Stream.toList()` 는 수정할 수 없는 `List` 라는 것을 반드시 숙지하고 계셔야 합니다.

만약 위 코드에서 선언된 `result`라는 리스트에 `add(), remove(), set()` 등의 함수를 호출하면

`UnsupportedOperationException`이 발생하게 됩니다.

자세히 알고 싶은 분들은 → Java 17 toList 공식 문서)

다만, 수정이 필요하다면 아래와 같이 `ArrayList`로 복사할 수 있습니다.

```java
List<Integer> editableList = new ArrayList<>(result);

editableList.add(7);

System.out.println(editableList);
```

### forEach - 각 값으로 작업

결과 리스트 없이 각 값을 출력하고 싶을 때 사용합니다.

```java
numbers.stream()
        .forEach(number -> System.out.println(number));
        

// 메서드 참조
numbers.stream()
        .forEach(System.out::println);
```

`Integer -> void` 이므로 `Consumer<Integer>` 형태입니다.

반환 타입이 `void`이므로 뒤에 `.toList()` 사용이 불가합니다.

### count - 개수 세기

몇 개가 조건을 만족하는지만 알고 싶다면 `List`를 만들 필요가 없겠죠.

아래와 같이 개수만 알 수 있습니다.

```java
long count = numbers.stream()
        .filter(number -> number % 2 == 0)
        .count();

System.out.println(count);
```

여기서 주의해야 할 점은 반환 타입이 `int`가 아닌 `long`이라는 점입니다.

### anyMatch - 하나라도 만족하는지

```java
boolean exists = numbers.stream()
        .anyMatch(number -> number >= 5);
        
System.out.println(exists);
```

조건을 만족하는 값이 하나라도 있으면 `true` 입니다.

### allMatch - 모두 만족하는지

```java
boolean result = numbers.stream()
        .allMatch(number -> number > 0);

System.out.println(result);
```

모든 값이 조건을 만족해야만 `true` , 하나라도 만족하지 않을 시에 `false` 를 반환합니다.

빈 `Stream`에서는 `true`를 반환합니다. 조건을 어기는 값이 하나도 없기 때문인데요,

따라서 `allMatch()`만으로 데이터가 존재한다는 사실을 확인할 수 없습니다.

### findFirst - 첫 번째 값 찾기

```java
Optional<Integer> number = numbers.stream()
        .filter(n -> n >= 3)
        .findFirst();

System.out.println(number);
```

이때 출력이 어떻게 되는지 한 번 확인해봅시다.

반환 타입이 3이 아니고 `Optional[3]`이 나옵니다.

왜 반환 타입이 `Integer`이 아니고 `Optional<Integer>` 일까요 ?

바로 결과가 없는 경우도 있을 수 있기 때문입니다. 

`Optional`은 있을 수도 있고 없을 수도 있는 결과를 표현합니다.

만약 리스트가 비어있어서 첫 번째 요소를 반환할 수 없는 경우 `NoSuchElementException`이 발생하게 됩니다.

그래서 비어있을 때를 대비에 `Integer` 대신 `Optional`로 반환합니다.

이제 본격적으로 `Optional`로 넘어가기 전에, `Stream` 사용 시 주의할 점을 몇 가지 정리하겠습니다.

## Stream의 특징과 주의점

### 원본 컬렉션을 직접 변경하지 않는다.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5);

List<Integer> result = numbers.stream()
        .filter(number -> number >= 3)
        .toList();

System.out.println(result);
System.out.println(numbers);
```

`filter()`는 원본 `List` 에서 1과 2를 삭제하지 않고, 조건에 맞는 요소만 다음 단계로 전달합니다.

다만, 람다 안에서 직접 객체를 변경하는 것까지는 막아주지 않습니다 !!

원본과 결과가 같은 객체를 가리킬 수 있기 때문에 `setter` 등으로 객체를 바꾸면 그 변경이 원본 쪽에서도 보일 수 있습니다.

작업 중인 원본 리스트에 요소를 추가하거나 삭제하는 코드도 지양해야 합니다.

`Stream`의 처리 과정과 충돌할 수 있습니다.

### Stream은 재사용할 수 없다.

다음은 잘못된 사용 예제입니다.

```java
List<Integer> numbers = List.of(1, 2, 3);

Stream<Integer> stream = numbers.stream();

stream.forEach(System.out::println);
stream.forEach(System.out::println);    // IllegalStateException
```

최종 연산이 끝난 `Stream`은 다시 사용할 수 없습니다.

변수에 저장해뒀다고 반복해서 읽을 수 있는 `List`가 되는 것은 아닙니다.

같은 데이터로 다시 처리하려면 새로운 `Stream`을 생성해야 합니다.
(원본 리스트는 그대로 사용할 수 있고, 처리 흐름인 `Stream`을 매번 새로 만들어야 함)

### 지연 연산

아래 코드를 봅시다.

```java
List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);

numbers.stream()
        .filter(number -> {
            System.out.println(number);

            return number % 2 == 0;
        });
```

잠깐 이 코드에 집중해봅시다. 과연 이 코드는 무엇을 출력할까요 ?

정답은 바로, 아무것도 출력되지 않는다 입니다.

처리 단계를 연결했지만, 최종 연산이 없어서 조건 검사 람다가 실행되지 않았습니다.

아래는 최종 연산을 붙인 코드입니다.

```java
List<Integer> result = numbers.stream()
        .filter(number -> {
            System.out.println(number);

            return number % 2 == 0;
        })
        .toList();

System.out.println(result);

/*
출력 결과:

1
2
3
4
5
6
[2, 4, 6]
*/
```

`filter(), map()` 같은 중간 연산을 할 때 `Stream`은 

> “나중에 필요하면 이렇게 처리해야겠다.”
> 

정도로만 기억해뒀다가, 마지막에 `.toList()`같이 최종 연산을 호출하면 그제서야 계산을 합니다.

이렇게 필요한 시점까지 처리를 미루는 것을 **지연 연산(Lazy Evaluation)** 이라고 합니다.

최종 연산이 있어도 항상 모든 요소를 확인하는 것은 아닙니다.

`findFirst()`나 `anyMatch()`처럼 대부분의 작업이 앞에서 끝나 뒤를 볼 필요가 없는 경우가 있는데

이를 **단락 평가(Short-circuit)** 이라고 합니다.

위 예시 코드는 흐름을 관찰하기 위한 것입니다.

중간 연산은 결과에 영향이 없으면 최적화를 위해 생략될 수 있으므로, 반드시 실행되어야 할 작업을 중간 연산 안에 넣는 습관은 피하는 것이 좋습니다.

### Stream이 항상 정답은 아니다.

조건 검사와 변환을 순서대로 연결할 때는 `Stream`이 읽기 좋습니다.

반면 복잡한 상태 변경이나 여러 외부 변수의 갱신이 중심이라면 반복문이 더 이해하기 쉬울 수 있습니다.

또한, `Stream`으로 코드를 작성한다고 해서 검색이 자동으로 빨라지는 것도 아닙니다.

리스트에서 `id`를 조건으로 찾는 작업은 최악의 경우 전체를 확인하기 때문에 여전히 `O(n)`입니다.

상황에 맞게, 읽는 사람이 처리 의도를 쉽게 이해할 수 있는 쪽을 선택하시면 됩니다.

---

## Optional이 필요한 이유

이제 본격적으로 `Optional`에 대해서 알아보도록 하겠습니다.

사용자를 찾는 메서드가 결과가 없을 때, `null`을 반환한다고 가정해보겠습니다.

아래 메서드는 그 상황을 보여주기 위해 항상 `null`을 반환하도록 만들었습니다.

```java
public User findUser(Long id) {
    return null;
}
```

이 메서드를 호출할 수 있는 같은 객체의 인스턴스 메서드 안에서 다음과 같이 처리할 수 있습니다.

```java
User user = findUser(1L);

if (user != null) {
		System.out.println(user.getName());
}
```

그런데 확인을 빠뜨리면 문제가 생깁니다. 다음은 예외가 발생하는 예제 코드입니다.

```java
User user = findUser(1L);

System.out.println(user.getName());    // NullPointerException
```

메서드 반환 타입이 `User`라는 것만으로는 결과가 없을 수 있다는 사실이 잘 드러나지 않습니다.

### 반환 타입에 결과 없음 표시하기

`Optional`은 **값이 존재할 수도 있고, 존재하지 않을 수도 있다는 사실을 명시적으로 표현하는 컨테이너**입니다.

같은 상황을 `Optional`로 표현하면 다음과 같습니다.

```java
public Optional<User> findUser(Long id) {
		return Optional.empty();
}
```

이렇게 작성하면 호출하는 쪽에서도 결과가 없을 때 어떻게 할지 정해야 한다는 것을 반환 타입에서 알 수 있습니다. 주로 결과가 없을 수 있는 메서드의 반환 타입에 사용합니다.

`Optional`이 `null`이나 `NullPointerException`을 완전히 없애주는 것은 아닙니다.

`Optional` 변수 자체에 `null` 을 넣거나, 내부 객체의 `null` 필드를 잘못 사용하면 여전히 문제가 생깁니다.

결과가 없으면 `null` 대신 `Optional.empty()`를 반환하도록 해야 합니다.

## Optional 생성 방법

값의 상황에 따라 만드는 방법이 달라집니다.

### of - null이 아닌 값 담기

```java
Optional<String> name = Optional.of("박연지");

System.out.println(name);    // Optional[박연지]
```

`null`이 아닌 값을 담습니다. 아래는 의도적으로 오류를 발생시킨 예제입니다.

```java
Optional.of(null);    // NullPointerException
```

`of()`는 `null`을 빈 상태로 바꿔주지 않습니다.

### ofNullable - null일 수도 있는 값 담기

```java
String name = null;

Optional<String> optional = Optional.ofNullable(name);

System.out.println(optional);    // Optional.empty
```

값이 있다면 그 값을 담고, `null`이면 빈 `Optional`을 만듭니다.

기존 메서드가 `null` 을 반환할 수도 있다면, 그 결과를 감쌀 때 사용할 수 있습니다.

### empty - 값이 없다는 상태 만들기

```java
Optional<String> optional = Optional.empty();

System.out.println(optional);    // Optional.empty
```

빈 `Optional` 객체와 `null` 은 다릅니다.

빈 `Optional`에는 `orElse()`같은 메서드를 호출할 수 있습니다.

정리하자면

| 상황 | 방법 |
| --- | --- |
| null이 아닌 값을 담는다 | `Optional.of(value)` |
| 값이 null일 수도 있다 | `Optional.ofNullable(value)` |
| 결과가 없음을 직접 표현한다 | `Optional.empty()` |

## Optional 주요 메서드

`Optional`을 받았다고 무조건 값을 꺼내는 것부터 시작하지 않아도 됩니다.

있으면 작업할지, 없으면 기본값을 쓸지, 반드시 있어야하는지. 부터 정하면 됩니다.

### isPresent - 값이 있는지 확인

```java
Optional<String> name = Optional.of("박연지");

if (name.isPresent()) {
    System.out.println("값이 있습니다.");
}
```

`isPresent()`는 존재 여부를 `boolean`으로 반환합니다. 값을 꺼내거나 작업을 실행하지는 않습니다.

### ifPresent - 값이 있을 때만 작업하기

```java
Optional<String> name = Optional.of("박연지");

name.ifPresent(
        value -> System.out.println(value)
);

// 메서드 참조
name.ifPresent(System.out::println);    // 박연지
```

`Optional`이 비어있으면 동작하지 않습니다.

`isPresent()`는 질문이고, `ifPresent()`는 값이 있을 때 수행할 작업을 전달하는 메서드라고 보면 됩니다.

### orElse - 없으면 기본값 사용하기

```java
Optional<String> name = Optional.empty();

String result = name.orElse("이름 없음");

System.out.println(result);
```

값이 있다면 그 값을, 없으면 사전에 작성해놓은 기본값을 반환합니다.

반환타입이 `Optional<String>`이 아닌 `String`이라는 점은 주의하셔야 합니다 !

### orElseGet - 없을 때 기본값 제공하기

```java
Optional<String> name = Optional.empty();

String result = name.orElseGet(
        () -> "홍길동"
);

System.out.println(result);
```

인자로 기본값을 받는 게 아니라, 기본값을 제공하도록 하는 동작을 받습니다.

`Optional`이 비어 있을 때만 이 `Supplier`을 호출합니다. 값이 이미 있다면 실행하지 않습니다.

### orElseThrow - 없으면 예외

반드시 사용자가 있어야 하는 상황이라면, 기본 사용자 정보를 제공해주지 않고 예외가 발생해야 합니다.

```java
Optional<User> optionalUser = Optional.of(
        new User(1L, "김석환", 24)
);

User user = optionalUser.orElseThrow();

System.out.println(user.getName());
```

인자 없는 `orElseThrow()`는 비어 있으면 `NoSuchElementException`을 발생시킵니다.

아래와 같이 예외와 메시지를 직접 지정할 수도 있습니다.

```java
Optional<User> optionalUser = Optional.empty();

User user = optionalUser.orElseThrow(
        () -> new IllegalArgumentException("사용자를 찾을 수 없습니다.")
);
```

입력 없이 예외 객체를 반환하므로 `Supplier<IllegalArgumentException>`형태입니다.

`Optional`이 비어 있으면 `Supplier`가 예외 객체를 만들고, `orElseThrow()` 가 예외를 던집니다.

예외가 발생하면 작성한 코드의 진행이 중단됩니다. 예외를 처리하는 자세한 방법은 5주차 때 박연지 코어님께서 자세히 알려주실 예정이니 많은 기대 부탁드립니다.

### map - 값이 있으면 변환

사용자의 전체 정보가 아닌 이름만 필요한 경우에 사용할 수 있습니다.

```java
Optional<User> user = Optional.of(
        new User(1L, "김석환", 24)
);

Optional<String> name = user.map(User::getName);

System.out.println(name.orElse("이름 없음"));    // 김석환
```

### filter - 값이 조건을 만족할 때만 유지

```java
Optional<User> user = Optional.of(
        new User(3L, "박연지", 24)
);

Optional<User> adult = user.filter(
        u -> u.getAge() >= 20
);

System.out.println(adult.isPresent());    // true
```

값이 존재하고, 조건을 만족하면 유지됩니다. 조건을 만족하지 않으면 빈 `Optional`이 되고,

처음부터 비어 있으면 조건 검사를 하지 않습니다.

### get - 값만 꺼내기

값을 직접 꺼내는 `get()` 도 있습니다.

```java
Optional<String> name = Optional.of("이우빈");

System.out.println(name.get());    // 이우빈
```

하지만 비어 있으면 아까도 말씀드렸듯이 `NoSuchElementException`이 발생합니다.

값이 있을 거라고 생각하고 무조건 호출하면 위험합니다. 자세한 설명 → Java 17 Optional 공식 문서)

존재 여부를 검사한 뒤 `get()` 을 쓰는 것이 틀린 코드는 아닙니다.

하지만 상황에 따라 지금까지 알려드린 메서드를 사용하면 본인이 코드를 작성한 의도를 보여줄 수 있습니다.

정리하자면

| 하고 싶은 일 | 사용할 메서드 |
| --- | --- |
| 값이 있을 때만 출력 | ifPresent() |
| 값이 없으면 기본값 | orElse() |
| 값이 없을 때 기본값 생성 | orElseGet() |
| 값이 없으면 예외 | orElseThrow() |
| 값이 있으면 변환 | map() |
| 값이 조건에 맞을 때만 유지 | filter() |

---

## Stream과 Optional 연결

이제 숫자 대신 사용자를 찾아보도록 하겠습니다.

```java
List<User> users = List.of(
        new User(1L, "우빈", 26),
        new User(2L, "연지", 24),
        new User(3L, "석환", 24)
);

Optional<User> user = users.stream()
        .filter(u -> u.getId().equals(2L))
        .findFirst();

user.ifPresent(u -> System.out.println(u.getName()));
```

`filter()`까지는 여러 `User`을 처리하는 `Stream<User>`입니다.

`findFirst()`에서 첫 결과를 하나 찾으면 `Optional<User>`가 됩니다.

아래는 이해하기 쉽도록 작성한 흐름도입니다.

```
List<User>
    ↓ stream()
Stream<User>
    ↓ filter: User → boolean
Stream<User>
    ↓ findFirst()
Optional<User>
```

`id`가 `100L`이면 결과가 없을 수도 있기 때문에 바로 `User`를 반환하지 않는 것입니다.

또 `findFirst()`는 일치하는 사용자가 하나뿐인지는 검사하지 않습니다.

여러 명이면 항상 첫 번째를 선택합니다.

만약 반드시 있어야 하는 사용자라면 다음과 같이 수정하면 됩니다.

```java
User user = users.stream()
        .filter(u -> u.getId().equals(2L))
        .findFirst()
        .orElseThrow();

System.out.println(user.getName());  
```

`findFirst()` 가 `Stream`의 최종 연산이죠 ? 근데 그 뒤에 `orElseThrow()` 가 붙었습니다.

`orElseThrow()` 는 `Stream`연산이 아니라 반환받은 `Optional`에 호출하는 메서드이기 때문에 옳은 코드입니다.

---

## User 객체를 사용한 종합 예제

이제 드디어 지금까지 배운 내용을 하나로 연결해보겠습니다.

!Group 10.png

!image.png

### User.java

```java
public class User {

    private Long id;
    private String name;
    private int age;

    public User(Long id, String name, int age) {
        this.id = id;
        this.name = name;
        this.age = age;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }
}

```

### Main.java

```java
public class Main {
		public static void main(String[] args) {
				List<User> users = List.of(
                new User(1L, "우빈", 26),
                new User(2L, "석환", 24),
                new User(3L, "연지", 24)
        );
		}
}
```

우리는 이 리스트를 사용할 예정입니다.

#### for문으로 이름 출력하기

25살 이상 사용자의 이름을 출력해보겠습니다.

```java
for (User user : users) {
		if (user.getAge() >= 25) {
				System.out.println(user.getName());
		}
}
```

#### Stream으로 이름 출력하기

위와 같은 요구사항을 적용한 코드입니다.

```java
users.stream()
				.filter(user -> user.getAge() >= 25)
				.map(User::getName)
				.forEach(System.out::println);
```

#### id가 3L인 사용자 찾기

```java
Long id = 3L;

User user = users.stream()
				.filter(u -> u.getId().equals(id))
				.findFirst()
				.orElseThrow(
								() -> new IllegalArgumentException("사용자를 찾을 수 없습니다.")
				);
				
System.out.println(user.getName());
```

1. `users`는 `List<User>`입니다.
    
    지난 시간에 배운 컬렉션과 제네릭 기억나시죠 ? 저장된 요소의 타입이 `User`라는 것을 알 수 있습니다.
    
2. `stream()`으로 처리를 시작합니다.
    
    `Stream<User>`를 만들어 `User`를 단계별로 처리하기 시작합니다.
    
3. `filter()`에 조건을 전달합니다.
    
    `u -> u.getId().equals(id)`는 `User`를 받아서 `boolean` 을 반환하므로 `Predicate<User>` 형태입니다.
    여기서 `u`는 사용자를 가리키는 매개변수입니다.
    

1. `findFirst()`로 첫 번째 결과를 찾습니다.
    
    이 최종 연산에서 `Stream`처리가 시작됩니다.
    일치하는사용자가 없을 수도 있기 때문에 `Optional<User>` 를 반환합니다.
    
2. `orElseThrow()`로 결과가 없을 때의 동작을 결정합니다.
    
    값이 있으면 `User`를 꺼내 반환하고, 없으면 전달받은 `Supplier`로 예외를 만들어 던집니다.
    
3. `() -> new IllegalArgumentException( ... )`은 `Supplier`입니다.
    
    입력을 받지 않고 예외 객체를 제공하는 구현입니다.
    값이 있는 경우엔 이 람다문을 실행하지 않습니다.
    

---

고생하셨습니다.

람다식, `Stream`, `Optional` 에 기초적인 내용 강의는 여기까지입니다.

오늘 배운 내용을 잘 이해했는지 확인하기 위해서 과제가 있어야겠죠 ?? ㅎㅎ

첫 과제이기 때문에 어려운 문제는 없고, 오늘 배운 내용만 잘 활용하면 금방 작성할 수 있습니다.

---

## 과제

`User.java`는 위 실습에서 사용한 코드 그대로 사용하시면 됩니다.

```java
List<User> users = List.of(
        new User(1L, "김석환", 24),
        new User(2L, "김수정", 21),
        new User(3L, "김서령", 20),
        new User(4L, "김현우", 20),
        new User(5L, "노강민", 25),
        new User(6L, "박연지", 24),
        new User(7L, "백민재", 24),
        new User(8L, "안정민", 23),
        new User(9L, "안령서", 22),
        new User(10L, "이길수", 24),
        new User(11L, "이삭", 24),
        new User(12L, "이승호", 22),
        new User(13L, "이우빈", 26)
);
```

위 코드는 유저 생성 코드입니다. 그대로 사용하시면 됩니다.

---

### 문제 1 - 조건에 맞는 사용자 목록

23살 이상인 사용자만 찾아서 `List<User>`로 만들고, 결과를 출력하세요.

### 문제 2 - 이름 목록

23살 이하인 사용자의 이름만 `List<String>`으로 만들고, 결과를 출력하세요.

### 문제 3 - 이름 출력

모든 사용자의 이름을 출력하세요. 람다식 버전과 메서드 참조 버전을 각각 작성하세요.

### 문제 4 - 사용자 검색

id가 `3L`인 사용자를 찾아 `Optional<User>`에 담으세요. 값이 있으면 이름을 출력하세요.

### 문제 5 - 사용자가 없을 때 예외

id가 `100L`인 사용자를 찾으세요. 사용자가 없다면 `사용자를 찾을 수 없습니다.`라는 메시지를 가진 `IllegalArgumentException`을 발생시키세요.

### 문제 6 - 하나라도 존재하는지 확인

30살 이상인 사용자가 한 명이라도 있는지 `boolean`으로 확인하고, 결과를 출력하세요.

### 문제 7 - 모두 만족하는지 확인

모든 사용자가 20살 이상인지 `boolean`으로 확인하고, 결과를 출력하세요.

### 문제 8 - 이름 정렬

20살 이상인 사용자들의 이름을 문자열 기본 순서로 정렬한 뒤, 정렬된 이름들을 출력하세요.

문제들은 `Main.java` 하나의 파일에 순서대로 풀이해주세요.

문제 코드별로 몇 번 문제인지 알 수 있도록 출력해주세요.

```java
// 예시
System.out.println("[문제 1]");
...

System.out.println("[문제 2]");
...
```

이번 과제는 백엔드 개발 중 자주 사용되는 개념, 문법들에 익숙해지기 위함이기 때문에 AI 사용을 금지합니다.

부디 양심적으로 본인이 스스로 공부해서 코드 작성하시길 바랍니다.
