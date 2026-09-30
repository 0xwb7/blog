---
title: "[프로그래머스] 기능개발"
description: "기능개발 문제 풀이"
pubDate: 2026-09-30

category: Algorithm

tags:
  - 알고리즘
  - 프로그래머스
  - 스택/큐

draft: false
---
## 문제 설명

프로그래머스 팀에서는 기능 개선 작업을 수행 중입니다. 각 기능은 진도가 100%일 때 서비스에 반영할 수 있습니다.

또, 각 기능의 개발속도는 모두 다르기 때문에 뒤에 있는 기능이 앞에 있는 기능보다 먼저 개발될 수 있고, 이때 뒤에 있는 기능은 앞에 있는 기능이 배포될 때 함께 배포됩니다.

먼저 배포되어야 하는 순서대로 작업의 진도가 적힌 정수 배열 progresses와 각 작업의 개발 속도가 적힌 정수 배열 speeds가 주어질 때 각 배포마다 몇 개의 기능이 배포되는지를 return 하도록 solution 함수를 완성하세요.

---

## 제한 사항

작업의 개수(progresses, speeds배열의 길이)는 100개 이하입니다.
작업 진도는 100 미만의 자연수입니다.
작업 속도는 100 이하의 자연수입니다.
배포는 하루에 한 번만 할 수 있으며, 하루의 끝에 이루어진다고 가정합니다. 예를 들어 진도율이 95%인 작업의 개발 속도가 하루에 4%라면 배포는 2일 뒤에 이루어집니다.

---

## 문제 이해

1. 각 기능은 진도가 100%일 때만 서비스에 반영 가능
2. 각 기능의 개발 속도는 모두 다르기 때문에 앞에 있는 기능보다 먼저 개발될 수도 있음
3. 근데 뒤에 있는 기능이 먼저 개발되더라도, 앞에 있는 기능이 완성되고 배포될 때 함께 배포됨
4. progresses는 배포되어야 하는 순서대로 작성된 작업의 배열
speeds는 progresses의 작업들의 속도 배열
5. 각 배포마다 몇 개의 기능이 동시에 배포되는지를 return

### 어떻게 풀지 ???

progresses가 [93, 30, 55], speeds가 [1, 30, 5] 라고 할 때
이해하기 쉽게 93 = A, 30 = B, 55 = C 라는 이름을 붙이겠음
A 작업 속도는 1이고, B 작업 속도는 30, C 작업 속도는 5임
A는 7일 후에 작업이 완료되고, B는 2일 뒤, C는 19일 뒤

그럼 A 작업이 되는 중에 B가 완료가 되고, C는 아직 미완성임
-> A 작업이 완료되는 순간 A와 B가 동시에 배포되어야 하고, C는 마지막에 배포
따라서 결과값은 [2, 1]

흠..
그러면 progresses랑 speeds의 배열 사이즈가 무조건 똑같으니까
progresses의 각 값들에 speeds의 값들을 더한다 ?

그리고 제일 앞 작업의 진행도를 100%로 맞추고 차례대로 확인했을 때,
100 이상인 작업이 연속으로 몇 개가 있는가 ?

93 94 95 96   97   98  99   100
30 60 90 120 150 180 210 240
55 60 65 70    75   80  85   90    95  100

그럼 A가 100이 되는 순간, B는 240이고, C는 90임
이걸 A를 배제하고 말하면, B가 240일 때 C는 90임
다시 B를 배제하고 말하면, C는 아직 90이라 작업 완료까지 2일이 더 필요한 상황

이런 식으로 앞 작업 중 100% 완료가 된 작업 뒤에, progresses가 100 이상인 값들을 세고,
100 미만인 작업을 마주칠 경우 break ?

그리고 작업이 완료된 progress와 그에 해당하는 speed를 배열에서 제거하고,
위 작업을 재실행 ?

아니면 몇 번째 작업부터 배포되지 않았는지 변수에 저장 후 다음 작업 ?

둘 다 가능할 거 같은데 어떤 게 더 효율적일지에 대해선 고민이 더 필요할 듯

아니다.
자바에서 배열을 사용할 때, 특정 인덱스를 삭제를 하게 되면
예를 들어 [A, B, C, D, E]가 있고 A, B가 배포가 완료됐다고 하면
[C, D, E, null, null] 이런 식으로 계속 스왑을 해야함
이렇게 되면 시간 복잡도가 좀 높아질 거 같음

차라리 두 번째 방식인 인덱스 위치값을 기억해놨다가 다음 작업에 들어가는 게 더 효율적일 거 같음

아 아니네
큐가 있잖아
큐를 사용하면 그냥 remove하면 됨
근데 스택은 안 됨. 이 문제는 FIFO가 중요한데, 스택은 LIFO이기 때문에 사용할 수 없음

아 근데 배열을 큐로 옮기는 작업이 필요함

일단 인덱스 위치 기억하는 방식으로 풀어보자

위 방식으로 코드 완성했고, 테스트 케이스도 모두 통과했음 

```java
package programmers.P42586;

import java.util.ArrayList;

public class Main {
    public static void main(String[] args) {
        int[] p = {20, 99, 93, 30, 55};
        int[] s = {10, 1, 1, 30, 5};

        solution(p, s);
    }

    public static int[] solution(int[] p, int[] s) {
        int len = p.length;
        ArrayList<Integer> arr = new ArrayList<>();

        int idx = 0;
        int total = 0;
        while (true) {
            int cnt = 0;
            toComplete(p, s, len, idx);
            for (int i = idx; i < len; i++) {
                if (p[i] >= 100) {
                    cnt++;

                    if (i == len - 1) {
                        total += cnt;
                        arr.add(cnt);
                    }
                } else {
                    arr.add(cnt);
                    total += cnt;
                    idx = i;
                    cnt = 0;
                    break;
                }

            }

            if (total == len) {
                break;
            }
        }

        int[] retArr = new int[arr.size()];

        for (int i = 0; i < arr.size(); i++) {
            retArr[i] = arr.get(i);
        }

        return retArr;
    }

    public static void toComplete(int[] p, int[] s, int len, int idx) {
        while (true) {
            if (p[idx] >= 100) {
                break;
            }

            for (int i = idx; i < len; i++) {
                p[i] += s[i];
            }

        }
    }
}
```

---

추가로 다른 방식으로도 풀 수 있을 거 같음
지금 방식은 하루씩 진행도를 올리는 방식인데,

1. 각 작업의 진행도를 매일 갱신하지 말고 몇 일 뒤에 완료되는지만 먼저 구한다
2. 첫 작업이 예를 들어 7일 뒤에 끝난다고 하면, 뒤 작업 중 7일 이내에 끝나는 것들을 모두 카운트
3. 그리고 인덱스 기억했다가 재작업

위 방식으로도 정답 맞췄음

근데 문제 발견
프로그래머스 반례에는 없는데 progresses = {99}, speeds = {1} 이면
idx = 0, len - 1 = 0 이라서 배열에 아무 것도 포함시키지 않고 프로그램이 종료됨
원래라면 [1] 이 나와야 하는데 ...

→ cnt 선언을 while문 밖으로 빼고 idx == len - 1 일 때 cnt를 arr에 추가해주는 방식으로 수정
그리고 for문에서 발생하는 마찬가지의 상황에서는 arr에 cnt값을 추가하지 않는 걸로 수정하니까 해결됨

다른 테스트 케이스도 모두 통과

```java
package programmers.P42586;

import java.util.ArrayList;

public class Main2 {
    public static void main(String[] args) {
        int[] p = {99};
        int[] s = {1};

        solution(p, s);
    }

    static int[] solution(int[] p, int[] s) {
        int len = p.length;
        int[] duration = getDuration(p, s, len);
        ArrayList<Integer> arr = new ArrayList<>();

        int idx = 0;
        int cnt = 1;
        int peek = duration[idx];
        while (true) {

            if (idx == len - 1) {
                arr.add(cnt);
                break;
            }

            for (int i = idx + 1; i < len; i++) {
                if (peek >= duration[i]) {
                    cnt++;
                } else {
                    arr.add(cnt);
                    cnt = 1;
                    idx = i;
                    peek = duration[idx];
                }

                if (i == len - 1) {
                    idx = i;
                }
            }
        }

        int[] retArr = new int[arr.size()];

        for (int i = 0; i < arr.size(); i++) {
            retArr[i] = arr.get(i);
        }

        System.out.println(arr);
        return retArr;
    }

    public static int[] getDuration(int[] p, int[] s, int len) {
        int[] arr = new int[len];

        for (int i = 0; i < len; i++) {
            if ((100 - p[i]) % s[i] != 0) {
                arr[i] = (100 - p[i]) / s[i] + 1;
            } else {
                arr[i] = (100 - p[i]) / s[i];
            }
        }

        return arr;
    }
}
```

---

근데 이렇게 코드를 수정하니까 while문이 꼭 필요한가?????? 에 대한 의문이 들기 시작함

현재 흐름을 보면

```java
while (true) {
    if (idx == len - 1) {
        arr.add(cnt);
        break;
    }
    
    for (int i = idx + 1; i < len; i++) {
        ...
    }
}
```

이런 식인데, 실제로 첫 번째 for문이 실행이 되면 i가 마지막 배열까지 가고 있잖아 ??

예를 들어

```java
duration = [5, 10, 1, 1, 20, 1]
```

이면 첫 번째 for 한 번으로

```java
peek = 5, idx = 0
i = 1, 2, 3, 4, 5
p[1] = 10 -> arr.add(cnt), peek = 10, idx = 1

peek = 10, idx = 1
i = 2, 3, 4, 5
p[2] = 1 -> cnt++
p[3] = 1 -> cnt++
p[4] = 20 -> arr.add(cnt), peek = 20, idx = 4

peek = 20, idx = 4
i = 5
p[5] = 1 -> cnt++, arr.add(cnt), break
```

이렇게 배열 전체를 다 처리함

그리고 마지막에서 idx를 마지막 인덱스로 바꾸고, 다시 while문 처음으로 돌아가서

```java
if (idx == len - 1) {
    arr.add(cnt);
    break;
}
```

이걸로 또 종료하고 있음

즉, 실행 구조가

while 1회차 → for문으로 전체 처리하고

while 2회차 → 마지막 cnt 추가하고 종료

이렇게 되고 있다는 거임

그래서 아까 말했듯 의문이 든 게, cnt를 굳이 두 번째 while문에서 추가할 필요가 있냐 ?? 이거지

idx 변수 제거 후 그냥 첫 번째 인덱스부터 시작하는 걸로, while문 제거하는 걸로, 마지막 cnt값은 for문 밖에서 추가해주는 걸로 수정할 예정이고 부가적으로 가독성을 챙기기 위해 리팩터링 했음

```java
package programmers.P42586;

import java.util.ArrayList;

public class Main3 {
    public static void main(String[] args) {
        int[] p = {99};
        int[] s = {1};

        solution(p, s);
    }

    static int[] solution(int[] p, int[] s) {
        int len = p.length;
        int[] duration = getDuration(p, s, len);
        ArrayList<Integer> deployCounts = new ArrayList<>();

        int cnt = 1;
        int deployDay = duration[0];

        for (int i = 1; i < len; i++) {
            if (deployDay >= duration[i]) {
                cnt++;
            } else {
                deployCounts.add(cnt);
                cnt = 1;
                deployDay = duration[i];
            }
        }

        deployCounts.add(cnt);

        int[] retArr = new int[deployCounts.size()];

        for (int i = 0; i < deployCounts.size(); i++) {
            retArr[i] = deployCounts.get(i);
        }

        System.out.println(deployCounts);
        return retArr;
    }

    public static int[] getDuration(int[] p, int[] s, int len) {
        int[] arr = new int[len];

        for (int i = 0; i < len; i++) {
            if ((100 - p[i]) % s[i] != 0) {
                arr[i] = (100 - p[i]) / s[i] + 1;
            } else {
                arr[i] = (100 - p[i]) / s[i];
            }
        }

        return arr;
    }
}
```
