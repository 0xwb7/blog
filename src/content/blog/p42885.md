---
title: "[프로그래머스] 구명보트"
description: "구명보트 문제 풀이"
pubDate: 2026-10-02

category: Algorithm

tags:
  - 알고리즘
  - 프로그래머스
  - 그리디 알고리즘

draft: false
---

## 문제 설명

무인도에 갇힌 사람들을 구명보트를 이용하여 구출하려고 합니다.

구명보트는 작아서 한 번에 최대 **2명**씩 밖에 탈 수 없고, 무게 제한도 있습니다.

예를 들어, 사람들의 몸무게가 [70kg, 50kg, 80kg, 50kg]이고 구명보트의 무게 제한이 100kg이라면

2번째 사람과 4번째 사람은 같이 탈 수 있지만 1번째 사람과 3번째 사람의 무게의 합은 150kg이므로 구명보트의 무게 제한을 초과하여 같이 탈 수 없습니다.

구명보트를 **최대한 적게 사용**하여 모든 사람을 구출하려고 합니다.

사람들의 몸무게를 담은 배열 people과 구명보트의 무게 제한 limit가 매개변수로 주어질 때,

모든 사람을 구출하기 위해 필요한 구명보트 개수의 최솟값을 반환하도록 solution 함수를 작성해주세요.

#### 제한사항

- 무인도에 갇힌 사람은 1명 이상 50,000명 이하입니다.
- 각 사람의 몸무게는 40kg 이상 240kg 이하입니다.
- 구명보트의 무게 제한은 40kg 이상 240kg 이하입니다.
- 구명보트의 무게 제한은 항상 사람들의 몸무게 중 최댓값보다 크게 주어지므로 사람들을 구출할 수 없는 경우는 없습니다.

---

## 문제 이해

최대 2명이 탈 수 있고, 무게 제한이 있는 구명보트를 최대한 적게 사용해서 모든 사람을 구출해야 하는데,

이때 필요한 구명보트의 개수를 찾으면 되는 문제인듯.

사람들의 몸무게가 [70, 50, 80, 50] 이고, 구명보트의 무게 제한이 100kg 이면

50 + 50, 70, 80 이런 식으로 구출하는 게 최소임 (구명보트 3개)

그럼 이걸 어떻게 구현해야 할까 고민해봤는데 나는 아래와 같이 생각했음

```
1. 몸무게를 오름차순으로 정렬한다.
2. 가장 가벼운 사람과 가장 무거운 사람의 몸무게를 더한 뒤, 무게 제한과 비교한다.
3. 둘이 같이 탈 수 있으면 둘 다 구출
4. 무게 제한보다 무거운 경우, 가장 무거운 사람만 구출
5. 보트 수 + 1
6. 모두 구출할 때까지 반복
```

## 코드

```java
package programmers.P42885;

import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] p = {70, 50, 80, 50};
        int l = 100;

        solution(p, l);
    }

    public static int solution(int[] p, int l) {
        Arrays.sort(p);

        int firstIndex = 0;
        int lastIndex = p.length - 1;
        int cnt = 0;

        while (true) {
            if (p[firstIndex] + p[lastIndex] <= l) {
                cnt++;
                firstIndex++;
                lastIndex--;
            } else {
                cnt++;
                lastIndex--;
            }

            if (firstIndex > lastIndex) {
//                System.out.println(cnt);
                return cnt;
            }
        }
    }
}

```
