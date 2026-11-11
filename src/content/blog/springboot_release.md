---
title: "Spring Boot 4.2.0 RC2 릴리스 노트를 읽고"
description: "Spring Boot 4.2.0-RC2 릴리스 노트를 읽고 주저리주저리 떠드는 글입니다."
pubDate: 2026-11-10
category: Java
tags:
  - Java
  - Spring Boot
  - Redis
  - Master/Replica
draft: false
---

## 들어가며

거의 한 달만에 작성하는 글이다 ,,,

그동안 많이 바쁘기도 했지만 갑자기 날이 추워지면서 게을러진 것 같다. 동면에 드는 곰처럼 ,,

한 달 뒤면 다시 시험기간이라 글을 못 쓸 수도 있지만, 그 전까지는 최대한 흥미로운 소재를 많이 찾고 읽어봐야겠다.

그렇게 다짐하고 이것저것 구글링을 하며 시간을 떼우다 스프링 공식 블로그 글을 발견했다.
(https://spring.io/blog/2026/11/06/spring-boot-4-2-0-RC2-available-now)

RC 버전이긴 했지만 ‘스프링 부트 3.5.x에서 4.1.2로 바꾼지 얼마 안 됐는데 벌써 새 버전이 올라오다니’

하며 생각 없이 읽다가 흥미로운 변경사항을 발견했다.

```
spring.data.redis.database is now applied to master/replica connections.
```

`spring.data.redis.database`가 뭔지는 정확히 모르겠지만, Master/Replica 연결이 이제야 적용된다고 한다.

무슨 의미인지 궁금해서 릴리스를 확인해 봤다.
https://github.com/spring-projects/spring-boot/releases/tag/v4.2.0-RC2

```
spring.data.redis.database is ignored when configuring master/replica nodes #52189
```

`spring.data.redis.database` 설정이 무시되고 있었다고 한다. 

Redis는 프로젝트를 하면서 몇 번 다뤄보긴 했지만 `spring.data.redis`까지만 주로 썼는데

뒤에 `database`를 붙인 설정은 어떤 역할을 하는 것이고, 기존에는 왜 무시되고 있었던 건지,

또 기존에 무시되던 설정이 정상적으로 적용된다면, 어떤 영향을 미칠 수 있는지에 대해서도 궁금해졌다.

이번 글에서는 Redis와 Master/Replica 구조부터 살펴보고, 버그와 수정 이후의 변화에 대해서 알아보고자 한다.

---

## Redis란 ?

Redis(Remote Dictionary Server)는 메모리 기반의 `Key-Value`데이터 저장소이다.

일반적인 RDBMS와는 다르게, Redis는 데이터를 메모리에 저장하고 처리하기 때문에

디스크 접근이 필요한 작업을 줄일 수 있어서 빠른 데이터 읽기와 쓰기에 유리하다.

또 Redis는 RDB와 AOF라는 영속화 방식을 지원하기 때문에 서버가 종료될 때 반드시 모든 데이터가 사라지는 것도 아니다.

- RDB(Redis Database): 특정 시점의 데이터를 스냅샷으로 저장
- AOF(Append Only File): 데이터 변경 명령을 로그로 기록하고, 재시작 시 이를 재실행하여 데이터 복구

### Redis의 논리적 데이터베이스

그런데 Redis에서도 데이터베이스를 구분해서 사용할 수 있다고 한다.

Redis Open Source의 일반적인 Standalone 구성에서는 하나의 Redis 인스턴스 안에 여러 개의 논리적 데이터베이스를 둘 수 있다고 한다.

하나의 Redis 서버를 여러 논리적 공간으로 나누어서 관리할 수 있다는 말인 것 같다.

기본 설정에서는 DB 0부터 DB 15까지 총 16개의 논리적 데이터베이스를 사용할 수 있으며, 이 개수는 설정을 통해 변경 가능하다.

예를 들어 다음과 같이 데이터를 저장할 수 있다.

```
127.0.0.1:6379> SELECT 0
OK
127.0.0.1:6379> SET user:1 "Kim"
OK
127.0.0.1:6379> SELECT 2
OK
127.0.0.1:6379[2]> SET user:1 "Lee"
OK
```

SELECT 명령어는 현재 연결에서 사용할 논리적 데이터베이스를 선택하는 명령어이다.

위 코드에서는 동일한 `user:1`이라는 key를 사용했지만, 서로 다른 DB에 저장했기 때문에 충돌하지 않는다.

실제로 조회해 보면 다음과 같다.

```
127.0.0.1:6379[2]> SELECT 0
OK
127.0.0.1:6379> GET user:1
"Kim"
127.0.0.1:6379> SELECT 2
OK
127.0.0.1:6379[2]> GET user:1
"Lee"
```

이걸 간단히 표현하면 다음과 같다.

```
Redis Instance
│
├── DB 0
│   └── user:1 = "Kim"
│
├── DB 1
│
├── DB 2
│   └── user:1 = "Lee"
│
└── ...
```

### Master/Replica 구조

Redis는 데이터를 복제하기 위한 Master/Replica 구조를 지원한다.

Master/Replica는 하나의 Redis 인스턴스를 Master로 두고,

다른 Redis 인스턴스들이 Master의 데이터를 복제하도록 구성하는 방식이다.

기본적인 구조는 다음과 같다.

```
           Application
                |
                v
           Redis Master
             (Write)
                |
       ┌────────┴────────┐
       |                 |
       v                 v
 Redis Replica 1    Redis Replica 2
     (Read)            (Read)
```

일반적으로 Master는 쓰기 요청을 처리하며, Replica는 Master의 데이터를 복제한다.

애플리케이션이 Replica로 읽기 요청을 보내도록 구성하면 읽기 부하를 여러 Redis 인스턴스로 분산할 수 있다.

다만 여기서 한 가지 주의할 점이 있는데, Redis의 복제는 기본적으로 비동기 방식으로 이루어진다는 점이다.

즉, Master에 데이터가 저장되었다고 해서 모든 Replica에 즉시 반영되는 것이 보장되지 않는다.

예를 들어 Master에서 `user:1` 의 값을 변경했더라도 복제가 완료되기 전에 Replica에서 조회하면 이전 값을 반환할 수 있다.

이러한 현상을 복제 지연(Replication Lag)이라고 한다.

### Replica의 논리적 DB

Master에 DB 0, DB 1, DB 2가 존재한다면 Replica에는 어떤 데이터가 저장될까 ?

Replica는 특정 DB 하나만 복제하는 것이 아니라, Master가 관리하는 전체 데이터셋을 복제한다.

따라서 정상적으로 복제가 이루어졌다면, 다음과 같은 구조이다.

```
Redis Master
├── DB 0
│    └── user:1 = "Kim"
├── DB 1
└── DB 2
     └── user:1 = "Lee"
     
      |
      |  Replication
      v
      
Redis Replica
├── DB 0
│    └── user:1 = "Kim"
├── DB 1
└── DB 2
     └── user:1 = "Lee"
```

즉, Master와 Replica는 서로 다른 논리적 DB를 사용하는 것이 아니라, 동일한 논리적 DB 구조와 데이터를 복제하여 유지하는 것이다.

그렇다면 애플리케이션에서는 어떤 DB에 접근할지 어떻게 결정할까 ?

앞서 Redis CLI에서는 SELECT 명령어를 사용해 데이터베이스를 선택했다.

Spring Boot에서는 이를 다음과 같은 설정으로 지정할 수 있다.

```yaml
spring:
  data:
    redis:
      database: 2
```

이 설정은 Spring Boot 애플리케이션이 Redis에 연결할 때 사용할 논리적 DB 번호를 지정한다.

위 설정은 Redis의 DB 2에 접근하도록 구성한 것이다.

기존에는 Master/Replica 연결을 구성하는 과정에서 바로 이 설정이 무시되고 있었다는 것이다.

그렇다면 실제로는 어떤 일이 발생하고 있었을까 ?

---

## 버그 수정 이전

앞서 Spring Boot에서는 `spring.data.redis.database` 설정을 통해 사용할 Redis의 논리적 DB를 지정할 수 있다고 했다.

그렇다면 다음과 같이 Master/Replica 연결을 구성했다고 가정해보자.

```yaml
spring:
  data:
    redis:
      database: 2
      masterreplica:
        nodes:
          - redis-master:6379
          - redis-replica:6379
```

설정을 하나씩 살펴보면

- `database: 2` : Redis의 논리적 DB 2를 사용하도록 지정한다.
- `masterreplica.nodes` : Master/Replica 연결에 사용할 Redis 노드들의 주소를 지정한다.

위 설정을 통해 개발자가 기대하는 동작은

애플리케이션이 Redis에 접근할 때 DB 2를 사용하고, Master에 저장된 데이터가 Replica에도 복제되는 것이다.

그런데 기존 Spring Boot에서는 예상과 다르게 동작했다고 한다.

이 버그를 수정한 PR(https://github.com/spring-projects/spring-boot/pull/52189) 을 보면

`spring.data.redis.masterreplica.nodes`를 설정하면 `DataRedisConnectionConfiguration`이 `RedisStaticMasterReplicaConfiguration`을 생성하는데, 

문제는 이 객체를 생성하는 과정에서 사용자가 지정한 데이터베이스 번호가 전달되지 않았다는 것이다.

조금 더 구체적으로 살펴보도록 하자.

Spring Boot에는 Redis 연결에 필요한 정보를 제공하는 `DataRedisConnectionDetails` 라는 인터페이스가 있다.

그런데 기존에는 `DataRedisConnectionDetails.MasterReplica` 에 데이터베이스 번호를 전달할 수 있는 메서드가 없었다.

따라서 `spring.data.redis.database`에 DB 2를 지정해줘도, 해당 값이 Master/Replica 연결 설정까지 전달되지 못했던 것이었고,

결과적으로 연결 설정에는 기본값이 사용되었다.

이 말은 즉, `spring.data.redis.database`에서 지정한 DB 번호가 무시되어, 항상 DB 0을 사용했다는 것이다.

PR 작성자의 테스트 코드에서도 확인할 수 있는데, 실제 Redis Master/Replica 환경에서 DB 1을 사용하도록 설정했지만, 

수정 전에는 DB 0에 데이터가 저장되었고 수정 후에는 정상적으로 DB 1에 저장되었다고 한다.

---

## 테스트 (4.1.2)

### compose.yml

```yaml
services:
  redis-master:
    image: redis:8.2-alpine
    command:
      - redis-server
      - --save
      - ""
      - --appendonly
      - "no"
      - --protected-mode
      - "no"

  redis-replica:
    image: redis:8.2-alpine
    command:
      - redis-server
      - --replicaof
      - redis-master
      - "6379"
      - --save
      - ""
      - --appendonly
      - "no"
      - --protected-mode
      - "no"
    depends_on:
      - redis-master

  app:
    image: gradle:8.14-jdk21
    working_dir: /workspace
    volumes:
      - ./:/workspace
      - gradle-cache:/home/gradle/.gradle
    environment:
      GRADLE_USER_HOME: /home/gradle/.gradle
    depends_on:
      - redis-master
      - redis-replica

volumes:
  gradle-cache:
```

### application.yml

```yaml
spring:
  application:
    name: redis-db-experiment

  main:
    web-application-type: none

  data:
    redis:
      database: 1
      masterreplica:
        nodes:
          - redis-master:6379
          - redis-replica:6379

```

### RedisTestApplication.java

```java
@SpringBootApplication
public class RedisTestApplication {

    private static final String KEY = "blog:db-test";

    public static void main(String[] args) {
        try (ConfigurableApplicationContext context =
                     SpringApplication.run(
                             RedisTestApplication.class, args
                     )) {
            // 실험 종료하면 끝
        }
    }

    @Bean
    ApplicationRunner test(StringRedisTemplate redisTemplate) {
        return args -> {
            String version = SpringBootVersion.getVersion();

            System.out.println("Spring Boot: " + version);

            String before = redisTemplate.opsForValue().get(KEY);
            System.out.println("Before write: " + before);

            redisTemplate.opsForValue()
                    .set(KEY, "saved-by-" + version);

            String after = redisTemplate.opsForValue().get(KEY);
            System.out.println("After write: " + after);
        };
    }
}
```

```bash
❯ docker compose up -d redis-master redis-replica
[+] up 2/2
 ✔ Container redistest-redis-replica-1 Running                                                0.0s
 ✔ Container redistest-redis-master-1  Running 
 
 
❯ docker compose exec redis-master redis-cli INFO replication
# Replication
role:master
connected_slaves:1
slave0:ip=172.18.0.3,port=6379,state=online,offset=836,lag=1
master_failover_state:no-failover
master_replid:d4fbb32e51baad95dfbca3d1dc943217a2c151c9
master_replid2:0000000000000000000000000000000000000000
master_repl_offset:836
second_repl_offset:-1
repl_backlog_active:1
repl_backlog_size:1048576
repl_backlog_first_byte_offset:1
repl_backlog_histlen:836

❯ docker compose exec redis-replica redis-cli INFO replication
# Replication
role:slave
master_host:redis-master
master_port:6379
master_link_status:up
master_last_io_seconds_ago:1
master_sync_in_progress:0
slave_read_repl_offset:878
slave_repl_offset:878
replica_full_sync_buffer_size:0
replica_full_sync_buffer_peak:0
master_current_sync_attempts:1
master_total_sync_attempts:1
master_link_up_since_seconds:560
total_disconnect_time_sec:0
slave_priority:100
slave_read_only:1
replica_announced:1
connected_slaves:0
master_failover_state:no-failover
master_replid:d4fbb32e51baad95dfbca3d1dc943217a2c151c9
master_replid2:0000000000000000000000000000000000000000
master_repl_offset:878
second_repl_offset:-1
repl_backlog_active:1
repl_backlog_size:1048576
repl_backlog_first_byte_offset:1
repl_backlog_histlen:878

❯ docker compose run --rm app gradle --no-daemon bootRun
...
Spring Boot: 4.1.2
Before write: saved-by-4.1.2
After write: saved-by-4.1.2

❯ docker compose exec redis-master redis-cli -n 0 GET blog:db-test
"saved-by-4.1.2"

❯ docker compose exec redis-master redis-cli -n 1 GET blog:db-test
(nil)
```

DB 1을 사용하도록 설정했지만 출력을 보면 실제로는 DB 1에 데이터가 저장되지 않았음을 알 수 있다.

## 테스트 (4.2.0-RC2)

```bash
❯ docker compose run --rm app gradle --no-daemon bootRun
...
Spring Boot: 4.2.0-RC2
Before write: null
After write: saved-by-4.2.0-RC2

❯ docker compose exec redis-master redis-cli -n 0 GET blog:db-test
"saved-by-4.1.2"

❯ docker compose exec redis-master redis-cli -n 1 GET blog:db-test
"saved-by-4.2.0-RC2"
```

4.2.0-RC2에서는 DB 1에 정상적으로 데이터가 저장되었고, 버그가 수정됐음을 알 수 있다.

---

## 버그 수정

그렇다면 4.2.0-RC2에서는 이 문제를 어떻게 해결했을지 알아보기 위해 PR #52189의 File Changed를 살펴봤다.
(https://github.com/spring-projects/spring-boot/pull/52189/changes)

### 1. DataRedisConnectionDetails.java

`DataRedisConnectionDetails` 는 Spring Boot가 Redis 연결을 구성하는 데 필요한 정보를 제공하는 인터페이스이다.

기존에는 내부의 `MasterReplica` 인터페이스에서 데이터베이스 번호를 제공하는 메서드가 없었는데, 이번 수정에서 추가되었다.

```java
// 4.1.2
interface MasterReplica {

		List<Node> getNodes();

}

// 4.2.0-RC2
interface MasterReplica {

	default int getDatabase() {
		return 0;
	}

	List<Node> getNodes();

}

```

`getDatabase()`는 연결할 Redis의 논리적 DB 번호를 반환하는 메서드이다.

OCP를 위반하지 않도록 수정한 걸 볼 수 있다.

만약 `getDatabase()`를 추상 메서드로 추가했다면, 기존에 `MasterReplica` 를 구현하던 클래스들이 새로운 메서드를 구현해야 했을 텐데

`default` 메서드로 기본 구현을 제공해서 기존 구현체를 변경하지 않아도 되게 했다.

그러면서도 필요한 구현체에서는 DB 번호를 직접 제공할 수 있도록 코드를 변경했다. 깔-끔

### 2. PropertiesDataRedisConnectionDetails.java

이 클래스는 `application.yml` 에 작성한 설정을 바탕으로 Redis 연결 정보를 제공한다.

```java
// 4.1.2
@Override
public @Nullable MasterReplica getMasterReplica() {
    DataRedisProperties.Masterreplica masterreplica = this.properties.getMasterreplica();
		return (masterreplica != null) 
		    ? new PropertiesMasterReplica(masterreplica) 
		    : null;
}

// 4.2.0-RC2
@Override
public @Nullable MasterReplica getMasterReplica() {
		DataRedisProperties.Masterreplica masterreplica = this.properties.getMasterreplica();
		return (masterreplica != null) 
		? new PropertiesMasterReplica(
					getStandalone().getDatabase(),
					masterreplica
		) 
		: null;
	}
```

이제는 Master/Replica 연결 정보를 생성할 때 데이터베이스 번호도 함께 전달한다.

여기서 `getStandalone().getDatabase()`를 사용하는 이유는 기존 Standalone 연결에서 사용하던 데이터베이스 설정값을 재사용하기 위해서이다.

이 값을 통해 `spring.data.redis.database`에 지정한 번호뿐 아니라 Redis URL에 포함된 데이터베이스 번호도 반영할 수 있다고 한다.

또한 `PropertiesMasterReplica` 내부에 데이터베이스 번호를 저장하고 반환하는 기능이 추가되었다.

```java
@Override
public int getDatabase() {
    return this.database;
}
```

이제 `MasterReplica` 연결 정보에서도 개발자가 설정한 DB 번호를 정상적으로 제공할 수 있게 되었다.

### 3. DataRedisConnectionConfiguration.java

이 클래스는 앞서 준비한 연결 정보로 실제 Redis 연결에 필요한 설정 객체를 생성한다.

기존에는 Master/Replica 연결을 구성할 때 `RedisStaticMasterReplicaConfiguration`에 노드와 인증 관련 정보는 설정했지만, 데이터베이스 번호는 지정하지 않았는데

이번 수정에서는 다음과 같이 변경되었다.

```java
// 4.1.2
protected final @Nullable RedisStaticMasterReplicaConfiguration getMasterReplicaConfiguration() {

			...
			
			return config;
		}
		
		return null;
}

// 4.2.0-RC2
protected final @Nullable RedisStaticMasterReplicaConfiguration getMasterReplicaConfiguration() {

			...
			
			config.setDatabase(
			    this.connectionDetails.getMasterReplica().getDatabase()
			);
			
			return config;
		}
		
		return null;
}
```

이 코드가 이번 버그 수정의 핵심이라고 볼 수 있다.

`getMasterReplica().getDatabase()`를 통해 앞에서 전달받은 DB 번호를 조회하고,

`setDatabase()` 를 통해 실제 연결 설정 객체에 적용하는 것이다.

기존에는 이 과정이 누락되어 있었기 때문에 사용자가 DB 2로 설정해도 기본값인 DB 0에 접근했던 것이었다.

생각보다 복잡한 문제는 아니었다.

Redis 자체에 문제가 있었던 것도 아니고, Master/Replic 복제 과정에서 데이터가 잘못 저장되는 것도 아니었다.

그냥 Spring Boot의 자동 설정 과정에서 데이터베이스 번호를 전달하고 적용하는 코드가 빠져 있었던 거였다.

근데 PR을 살펴보던 중에 또 하나 흥미로운 내용을 발견했다.

```
Thanks for the PR. I am not 100% sure we should take the risk to apply that in 4.0.x given it changes the runtime behavior. Anyone who sets database=N together with masterreplica.nodes is silently on database 0 today. After upgrading to a release with this fix, the same configuration reads and writes database N.

Flagging to get more feedback from the team.
```

Spring Boot 개발자가 해당 수정 사항을 4.0.x 버전에 적용하는 것에 우려를 표했다.

이유는 버그 수정으로 인해 기존 애플리케이션의 실행 동작이 달라질 수 있기 때문이었다.

---

## 버그 수정의 영향

위에서 봤듯, 버그 수정으로 인해 기존 애플리케이션의 실행 동작이 달라질 수 있기 때문에 4.0.x 버전에 적용하는 것이 우려스럽다고 표현했다.

우리가 앞서 진행한 실험을 생각해보면 충분히 이해할만한 우려였다.

기존에는 `database: 1`로 설정해도 DB 0에 데이터를 저장하고 있었다.

하지만 버그가 수정된 버전에서는 설정한 대로 DB 1을 사용하게 된다.

문제는 기존 DB 0에 저장되어 있던 데이터가 DB 1로 자동으로 이전되는 건 아니라는 점이다.

만약 Redis의 Master/Replica 구조를 쓰던 프로젝트가 이 버그 픽스를 인지하지 못한 채로 스프링 부트 버전을 업그레이드 한다면 어떻게 될까 ?

### 1. 캐시 데이터의 삭제 ?

먼저 Redis를 캐시 용도로 사용하는 경우이다.

일반적으로 Cache-Aside 패턴을 사용하는 서비스에서는 다음과 같은 순서로 데이터를 조회한다.

1. Redis에서 데이터 조회
2. 데이터가 있다면 Redis 값 반환
3. 데이터가 없다면 원본 데이터베이스에서 조회, 조회한 데이터를 Redis에 저장 후 반환

이러한 구조에서는 Redis에 캐시가 없더라도 원본 데이터베이스에서 데이터를 가져올 수 있다.

따라서 이 버그가 수정되더라도 반드시 서비스에 장애가 발생하는 것은 아니다.

하지만 다른 문제가 발생할 수 있다.

예를 들어 상품 정보를 캐싱하는 서비스에서 기존 DB 0에 수많은 상품 정보가 저장되어 있었다고 가정해보자.

버그가 수정되면서 애플리케이션이 DB 0이 아닌, DB 1에 접근한다면 어떻게 될까 ?

기존에 캐싱되어 있던 데이터는 모두 DB 0에 남아 있기 때문에 DB 1에서는 캐시 미스가 발생한다.

그러면 평소 Redis에서 처리하던 요청들이 원본 데이터베이스로 전달될 수 있다.

트래픽이 적은 서비스라면 큰 문제가 없을 수도 있지만, 

요청량이 많은 서비스라면 순간적으로 데이터베이스의 부하가 증가하고, 심하면 응답 지연이나 타임아웃이 발생할 수도 있다.

즉, 버그 수정으로 캐시 자체가 삭제되는 것은 아니지만, Cache Hit Rate가 급격히 감소하면서 성능적인 이슈가 발생할 가능성이 있다.

### 2. Refresh Token 조회 불가

예를 들어 로그인에 성공한 사용자의 Refresh Token을 Redis에 저장하고,

토큰 재발급 요청이 들어오면 Redis에 저장된 값과 비교하는 구조라고 가정해보자.

```
Redis DB 0

refresh:user:1 = "tokenA"
refresh:user:2 = "tokenB"
refresh:user:3 = "tokenC"
```

기존에는 DB 0에 접근했지만 실제 접근하는 DB가 1로 변경된다면

DB 1에는 Key가 존재하지 않으므로 null이 반환될 수 있다.

만약 애플리케이션이 Redis에 저장된 토큰의 존재 여부를 기준으로 재발급을 허용한다면,

사용자는 유효한 Refresh Token을 가지고 있더라도 새로운 Access Token을 발급받지 못할 수 있다.

## 대응 방법

가장 먼저 해야 할 일은 애플리케이션이 어떤 Redis DB를 사용하고 있는지 확인하는 것이다.

특히 다음 조건을 만족하는 서비스라면 주의할 필요가 있다.

- Spring Boot의 Master/Replica 연결 설정을 사용하고 있다.
- `spring.data.redis.database` 또는 Redis URL을 통해 DB 0이 아닌 다른 DB를 지정했다.

이러한 서비스에서는 업그레이드 이후 실제로 접근하는 DB가 달라질 수 있다.

그렇다면 대응 방법은 무엇일까 ?

### 1. DB 0 사용

애플리케이션에서 DB 0을 계속 사용해도 문제가 없다면 다음과 같이 명시적으로 설정할 수 있다.

```yaml
spring:
  data:
    redis:
      database: 0
```

사실상 가장 간단한 방법이면서도, 릴리스 노트에서도 기존 DB 0을 사용하려는 경우 데이터베이스 설정을 제거하거나 0으로 명시하라고 안내하고 있다.
(https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.2.0-RC2-Release-Notes)

### 2. 데이터 이전

애초에 DB 1을 사용하려던 목적이 있었다면 기존 DB 0의 데이터를 DB 1로 이전하는 방법도 고려해볼 수 있다.

## 마치며

처음엔 Spring Boot의 새로운 버전이 나왔다는 소식에 별생각 없이 블로그를 읽기 시작했는데

릴리스 노트를 읽다보니 Redis의 논리적 데이터베이스부터 Master/Replica 구조, Spring Boot의 자동 설정 과정까지 뜯어봤다 ㅎ

버그 수정 영향 파트를 작성하면서 떠오른 사진이 있는데,

바로 먼지가 잔뜩 쌓여 형체를 알아볼 수 없는 전자기기가 정상적으로 작동하고 있는 사진이다.

이런 말이 있지 않은가 ?

먼지도 부품의 일부이니 돌아간다면 그냥 두어라 ,,,,

이번 버그도 그래야할까 ?

새로운 지식을 얻게 된 점도 좋지만, 버그 수정이 언제나 긍정적인 영향만 주는 것은 아니라는 점에서 많은 생각이 드는 글이었다.
