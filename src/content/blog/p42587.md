---
title: "[프로그래머스] 프로세스"
description: "프로세스 문제 풀이"
pubDate: 2026-09-30

category: Algorithm

tags:
  - 알고리즘
  - 프로그래머스
  - 스택/큐

draft: false
---
## 문제 이해

```
1. 실행 대기 큐(Queue)에서 대기중인 프로세스 하나를 꺼냅니다.
2. 큐에 대기중인 프로세스 중 우선순위가 더 높은 프로세스가 있다면 방금 꺼낸 프로세스를 다시 큐에 넣습니다.
3. 만약 그런 프로세스가 없다면 방금 꺼낸 프로세스를 실행합니다.
  3.1 한 번 실행한 프로세스는 다시 큐에 넣지 않고 그대로 종료됩니다.
```

그럼 [A, B, C, D]가 순서대로 실행 대기 큐에 있고, 우선순위가 [2, 1, 3, 2] 라면

1. A 꺼냈는데 C가 더 우선이라 A는 다시 큐에 넣는다
    
    → [B, C, D, A], [1, 3, 2, 2]
    
2. B 꺼냈는데 C가 더 우선이라 B는 다시 큐에 넣는다
    
    → [C, D, A, B], [3, 2, 2, 1]
    
3. C 꺼냈고, C가 가장 우선
4. D 꺼냈고, D가 가장 우선
5. A 꺼냈고, A가 가장 우선
6. B 꺼냈고, B가 가장 우선

그럼 작업 순서는 C → D → A → B

## 어떻게 풀지 ?

일단 제일 먼저 생각나는 방식은 프로세스 큐와 우선순위 큐를 동시에 작업하는 방식 ?

프로세스 큐랑 우선순위 큐에서 값을 동시에 뽑고,

방금 뽑은 우선순위 큐값보다 큐에 더 큰 값이 존재한다면 다시 넣고 이걸 반복

근데 이렇게 하면 poll도 두 번씩, offer도 두 번씩 해야되는 번거로움이 있긴 할 듯

이 두 개를 묶어서 한 번에 작업할 수는 없나 ?

map을 사용하기엔 이 문제의 카테고리가 스택/큐라 사용하고 싶지 않음

아니면 차라리 index랑 priority 이 두 변수를 가지고 있도록 하는 클래스를 만들어서 사용 ?

이것도 나쁘지 않아보임

아니면 이렇게 복잡하게 할 필요 없이 처음부터 큐를 배열로 선언하던가

## 코드

### 1차

```java
import java.util.LinkedList;
import java.util.Queue;

public class Main {
    public static void main(String[] args) {
        Queue<Process> q = new LinkedList<>();
        Queue<Process> q2 = new LinkedList<>();

        int[] p = {2, 1, 3, 2};
        int loc = 2;

        for (int i = 0; i < p.length; i++) {
            q.offer(new Process(i, p[i]));
        }

//        for (int i = 0; i < q.size(); i++) {
//            Process current = q.poll();
//            System.out.println(current.index + " " + current.priority);
//            q.offer(current);
//        }

        while (!q.isEmpty()) {
            int size = q.size();
            int max = Integer.MIN_VALUE;

            for (int i = 0; i < size; i++) {
                Process current = q.poll();

                if (current.priority > max) {
                    max = current.priority;
                }

                q.offer(current);
            }

            for (int i = 0; i < size; i++) {
                Process current = q.poll();

                if (current.priority == max) {
                    q2.offer(current);
                    break;
                } else {
                    q.offer(current);
                }
            }
        }

        int tmp = 0;
        int cnt = 0;
        for (int i = 0; i < q2.size(); i++) {
            Process current = q2.poll();
            cnt++;

            System.out.println(current.index + " " + current.priority);

            if (current.index == loc) {
                tmp = cnt;
            }

            q2.offer(current);
        }

        System.out.println(tmp);
    }

    static class Process {
        int index;
        int priority;

        public Process(int index, int priority) {
            this.index = index;
            this.priority = priority;
        }
    }
}
```

일단은 생각나는대로 풀어서 코드가 너무 더럽다 ,,,, 리팩토링하겠음

### 2차

```java
import java.util.LinkedList;
import java.util.Queue;

public class Main {
    public static void main(String[] args) {
        Queue<Process> q = new LinkedList<>();

        int[] p = {1, 1, 9, 1, 1, 1};
        int loc = 0;

        for (int i = 0; i < p.length; i++) {
            q.offer(new Process(i, p[i]));
        }

        int cnt = 0;
        int tmp = 0;
        while (!q.isEmpty()) {
            int size = q.size();
            int max = Integer.MIN_VALUE;

            // 큐 내 최대값 구하기
            for (int i = 0; i < size; i++) {
                Process current = q.poll();

                if (current.priority > max) {
                    max = current.priority;
                }

                q.offer(current);
            }

            /*
            값이 최대일 때 (최대값이 아니면 뒤로 offer -> 최대값이면 이번 탐색 끝)
            근데 최대값을 가진 인덱스가 location이랑 같을 때 return
             */
            for (int i = 0; i < size; i++) {
                Process current = q.poll();

                if (current.priority == max) {
                    cnt++;

                    if (current.index == loc) {
                        tmp = cnt;
                        break;
                    }

                    break;
                } else {
                    q.offer(current);
                }
            }
        }

        System.out.println(tmp);
    }

    static class Process {
        int index;
        int priority;

        public Process(int index, int priority) {
            this.index = index;
            this.priority = priority;
        }
    }
}
```

달라진 점은 큐를 하나만 쓰도록 수정했다.

프로세스 작업마다 cnt를 증가시키고 index와 location이 같아지는 순간 끝내도록

아 근데 매번 순회하면서 max를 찾는 게 너무 비효율적인 거 같다. 최악이면 O(N^2)일 거 같다.

차라리 외부에서 미리 우선순위를 정렬시키고, 그 0번 인덱스값(최대값)보다 작으면 뒤로 보내고

같으면 작업하는 방식으로 하면 좀 더 최적화할 수 있을 거 같다.

### 최종 코드

```java
package P42587;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedList;
import java.util.Queue;

public class Main {
    public static void main(String[] args) {

        int[] p = {2, 1, 3, 2};
        int loc = 2;

        System.out.println(solution(p, loc));
    }

    public static int solution(int[] priorities, int location) {
        Queue<Process> q = new LinkedList<>();

        for (int i = 0; i < priorities.length; i++) {
            q.offer(new Process(i, priorities[i]));
        }

        Integer[] p = sortArr(priorities);

        int cnt = 0;
        int idx = 0;
        while (!q.isEmpty()) {
            Process current = q.poll();

            if (current.priority == p[idx]) {
                cnt++;
                idx++;

                if (current.index == location) {
                    return cnt;
                }
            } else {
                q.offer(current);
            }
        }

        return cnt;
    }

    static class Process {
        int index;
        int priority;

        public Process(int index, int priority) {
            this.index = index;
            this.priority = priority;
        }
    }

    static Integer[] sortArr(int[] p) {
        Integer[] arr = Arrays.stream(p)
                .boxed()
                .toArray(Integer[]::new);

        Arrays.sort(arr, Collections.reverseOrder());
        return arr;
    }
}

```

사실 priorities 배열을 오름차순 정렬해서 뒤에서부터 인덱스를 세는 게 코드가 더 짧고 간단할 수 있는데

내가 헷갈려서 이렇게 했음
