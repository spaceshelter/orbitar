We're discussing implementation of the awards system for a collective blog. Below are some of the extracts with some points we've made.


# Orbitar Awards System Discussion Overview

## Core Context
- Discussion about implementing an "Award Marker System" for Orbitar platform
- Focus on creating a limited-resource recognition mechanism
- Multiple approaches debated between users: Aivean, Andrew Me, stormos, and reference to @Good

## Main Proposals

### 1. Time-based Star Rating
**Proposed by Aivean**
- Stars accumulate rating based on how long they remain on content
- Example: A star present for a week contributes more to rating than one present for a day
- Ratings calculated as fraction of time period (1/4 + 1/30 = 0.28 for a post with two stars)
- Only "active" stars count (from active users)

**Pros:**
- Better than no recognition for older content
- Encourages thoughtful star placement
- Accumulates value over time

**Cons:**
- Potentially complex for users to understand
- Requires remembering where stars are placed

### 2. Single Permanent Star System
**Advocated by stormos**
- "One username - one star. Clean and simple"
- Stars assigned for minimum one day, maximum one month
- User profile shows where their star is placed

**Pros:**
- Simple conceptually
- Preserves "sentimental value" of stars
- No inflation of recognition currency

**Cons:**
- Limited flexibility
- Implementation challenges for tracking "star peaks"

### 3. Daily/Weekly Star Allocation
**Discussed by Andrew Me & Aivean**
- Users receive regular "star dust" or tokens
- Could be daily or weekly allocation
- Limited accumulation (cap of ~7 units)
- Non-transferable once placed

**Pros:**
- Encourages regular engagement
- Provides balanced voting power
- Less pressure on single star placement

**Cons:**
- Daily allocation might devalue recognition
- More active users have disproportionate influence

### 4. Token System with Categories
**Proposed by Aivean**
- 3-4 tokens per month allocated to users
- Limited accumulation (max 4)
- Tokens can mark posts, comments, and users
- Different token types (like Discord/Telegram reactions)
- Short text can be added to tokens

**Pros:**
- Flexible foundation for secondary mechanisms
- Could support multiple use cases (awards, notes, achievements)
- Encourages online activity

**Cons:**
- May not work well for nominations close to cutoff dates
- Uneven token value depending on allocation timing

### 5. Color/Emotion-Coded Stars
**Proposed by stormos**
- Stars follow a color spectrum or emotional scale
- From red to green or varying emoji expressions
- Represents importance spectrum (important but bad to important and good)
- Size/brightness represents quantity

**Pros:**
- Adds qualitative dimension to recognition
- Could serve multiple purposes (voting, polls)
- Adds visual engagement

**Cons:**
- More complex UX for multiple star placement
- Requires scale adjustment based on content age

## Key Considerations Throughout Discussion

### Resource Scarcity
- Debate between single resource vs. multiple tokens
- Concern about "inflation" of recognition value
- Trade-offs between simplicity and flexibility

### Implementation Challenges
- Tracking star expiration and "peaks"
- Performance considerations for database queries
- Visualization of different star quantities and types

### User Experience
- Simplicity vs. functionality
- Remembering where stars are placed
- Clear visual representation of star value

### Democracy vs. Weighted Influence
- Whether users with higher karma should have more influence
- Concern about top 10% of users determining nominations
- Balancing active vs. occasional participation

### Platform Culture
- Mentions that "Orbitar is already too toxic"
- Concerns about negative recognition options
- Desire to incentivize positive behaviors

The discussion remained open-ended with participants still considering which approach would best balance technical feasibility, user experience, and community health.




# Award System Design - Single vs. Two-Stage Approach

## 1. Context

Orbitar is developing a monetary award system (0.5 BTC annually) for a collective blogging platform. Two primary approaches are being considered:

1. **Two-Stage System**: Nomination via tokens/markers followed by a separate final voting phase
2. **Single-Stage System**: Continuous token accumulation with winners determined at a specified cutoff time

## 2. Current Data

### 2.1 Award Marker System (Document 1)
- **Resource Allocation**: One marker per privileged user
- **Assignment Options**: Posts, comments, or user profiles
- **Constraints**: No self-assignment, exclusive assignment
- **Lifecycle**: 30-day expiration, reassignable at any time
- **Visibility Features**:
    * User profile displays (current assignment, received markers)
    * Three separate leaderboards (users, posts, comments)
    * Content displays active marker count with source information
    * Visual indicators (★ filled for active, ☆ outline for expired)

### 2.2 Award Implementation Details (Document 2)
- **Prize Structure**: 0.5 BTC annually, starting at 0.008 BTC per award, increasing to 0.037 BTC
- **Legal Framework**: Direct gift between individuals through an intermediary
- **Initial Nomination Process**:
    * 8 nominees from leaderboard (excluding negative karma users and previous winners)
    * Voting through comments on a special post
    * Tiebreakers include splitting the award, intermediary selection, second round, or random selection
- **Timeline**: Weekly initially, then monthly (Wednesdays at 19:00 UTC)
- **Winner Recognition**: Star badge in profile

### 2.3 Alternative Token System
- **Resource Allocation**: 3-4 tokens monthly per user
- **Token Properties**:
    * Non-accumulating beyond maximum
    * Can include attached short text
    * Different token types (visual distinctions)
    * Non-expiring but replaceable
- **Implementation Benefits**:
    * Simple rules and implementation
    * Foundation for secondary mechanics
    * Encourages regular site visits

## 3. Problem Statement

Determine which award system approach (single or two-stage) better serves Orbitar's community based on objective criteria including:
- User engagement
- System complexity
- Fairness and resistance to manipulation
- Administrative overhead
- Community experience

## 4. Approach Comparison

### 4.1 Two-Stage Approach

**Process Flow**:
1. Nomination period using markers/tokens
2. Top candidates advance to final voting in dedicated post
3. Winner determined by community vote

**Characteristics**:
- Creates distinct nomination and decision phases
- Two separate community participation events
- May include special rules for tiebreakers

### 4.2 Single-Stage Approach

**Process Flow**:
1. Continuous token/marker assignment
2. Winner determined by highest token count at specified deadline
3. No separate voting phase

**Characteristics**:
- Seamless process without transition between phases
- Real-time standings visible throughout
- Direct correlation between tokens and winning

## 5. Analysis Criteria

For each approach, evaluate:

### 5.1 Community Engagement
- Participation rates and barriers
- Sustained vs. spike engagement patterns
- Visibility and transparency effects

### 5.2 Technical Implementation
- Development complexity
- Maintenance requirements
- Platform integration considerations

### 5.3 Award Integrity
- Vulnerability to manipulation or gaming
- Recency bias effects
- Content type advantages/disadvantages

### 5.4 User Experience
- Learning curve and comprehensibility
- Award cycle experience (anticipation, participation, aftermath)
- Recognition distribution (winners vs. nominees)

### 5.5 Administrative Requirements
- Oversight and intervention needs
- Cycle management complexity
- Adaptability to community growth

## 6. Decision Framework

The optimal system should balance:
- Alignment with Orbitar's "asocial network principles"
- Resource limitations (one marker per user vs. multiple tokens)
- Desired award formality and community impact
- Technical feasibility and maintenance considerations
- Resistance to systematic manipulation

## 7. Expected Deliverables

- Comparative analysis of single-stage vs. two-stage approaches
- Identification of key tradeoffs and their implications
- Recommendation based on Orbitar's specific context and goals
- Implementation considerations for the recommended approach



----



# discussion



TL;DR:

Best Proposals:
Proposal #4 (Monthly Limited Token Allocation with Categories) seems strongly aligned (high flexibility, balanced fairness, integrity via capped tokens).
Proposal #2 (Single Permanent Star) is very strong in simplicity and integrity but perhaps limited in flexibility, engagement, and regular incentive.


A Two-stage system is recommended for your specific community. It will clearly separate a relaxed nomination phase (monthly tokens/markers) from a definitive and consolidated final voting event.
Proposal #4 aligned to Two-Stage structure is ideal: tokens as nominations, then a regular vote.
Community size (150 daily engaged, ~800 MAU) allows you manageably orchestrate a monthly "final voting event".
This system reduces manipulation, maximizes anticipation, provides transparency, and feels rewarding.

stormos — 28.02.2025, 00:40
немножко каша из-за смешения несвязанных аспектов.
звездочки надо делать хорошо, не оглядываясь на награды.

категории и цвета - надстройка над звездочками

иерархия звездочек:  коммент - пост - юзер.
гаснут ли звёздочки?
stormos — 28.02.2025, 00:53
когда можно переставить звездочку? всегда, календарный период, период после первой установки, период после последней перестановки, никогда

Aivean — 28.02.2025, 00:54
в варианте с единственным маркером — гаснут,
в варианте с постепенной выдачей — нет
stormos — 28.02.2025, 00:55
сколько звёздочек у юзернейма? варианты одна, пропорционально карме и/или пропорционально числу категорий
Aivean — 28.02.2025, 00:56
в варианте с одним маркером — всегда

в варианте с постепенной выдачей, можно сделать без этого (для простоты), если будет нужно — добавить переставление
я это вижу как отдельный UI при постановке, который позволяет тебе выбрать, откуда ставить звезду, из запаса или переставить одну из нескольких недавних
stormos — 28.02.2025, 00:57
накопление звездочек
Aivean — 28.02.2025, 00:59
в первом варианте звезды в "запасе" без категорий, при назначении можно выбрать категорию
в будущем это можно расширять разными механиками, вводить ограничения на категории или отдельные запасы для уникальных токенов/звезд

я предлагаю выдавать всем с одной скоростью, но сделать кап, больше которого не копятся, зависимым от кармы. скажем, от 1-3  у разных людей
stormos — 28.02.2025, 01:04
надо сужать скоп принимая решения
stormos — 28.02.2025, 01:13
у нас сейчас главное несогласие по категориям. мне идея не нравится эстетически, и я избегаю ее обдумывать. это не продуктивно. можем ли мы согласиться, что категории можно сделать потом?
как нам вообще принимать решения?
stormos — 28.02.2025, 01:31
забытая идея пыли: звездочек бесконечно много. прилипают к постам навсегда. переставлять нельзя. можно не более х1* (карма) звёздочек в секунду. х2карма в минуту, х3карма в час..    визуально что-то меняет только 100 звёздочек
stormos — 28.02.2025, 03:23
а в чем смысл накопления заездочек дающими? тем более с капом.  может сразу выдать этот кап
stormos — 28.02.2025, 06:33
альтернатива ui: в профиле видны поставленные тобой звезды. (полная история, возможно с пагинатором)  те, которые поставлены недавно - можно снять. снятая добавлятся в счетчик доступных.
можно ли одному посту:комменту юзеру-поставить много звёзд?
Aivean — 28.02.2025, 08:16
да, можно потом, это нас не блокирует

это одна потенциальных механик геймификации, которые можно добавить в будущем
Aivean — 28.02.2025, 08:18
это почти изоморфно идее выдавать звезды постепенно, но при этом гораздо меньше scarcity ресурса
Aivean — 28.02.2025, 08:22
смысл в ограничении скорости выдачи (для создания редкости ресурса)
накопление нужно, чтобы сгладить "пилу" и дать возможность людям дольше решать, куда тратить

если всем выдавать по капу (тем более, если он зависит от кармы), это создать сильное disparity в силе голоса (активность и карма будут очень сильно влиять на силу голоса)
Aivean — 28.02.2025, 08:23
можно так, тем более, что историю звезд в любом случае показывать стоит
Aivean — 28.02.2025, 08:24
с точки зрения механики роли не играет, надо подумать, что более естественно для UX
stormos — 28.02.2025, 08:38
а нам оно нужно? когда реддит продавал монетки это было важно. а у нас есть более простой механизм подстройки scarity в виде курса крама/заездочки
stormos — 28.02.2025, 08:41
пилы вообще нет если у тебя фиксированное по карме число звездочек. ты всегда распределяешь свои 5 между лучшим на текущий период
Aivean — 28.02.2025, 08:45
потому что иначе это просто будут еще одни плюсики

scarcity поднимает ценность ресурса, и заставляет думать, на что его тратить
stormos — 28.02.2025, 08:47
если делать в профиле, то сразу решаешь вопрос доступа к 'архиву' работает как лайт-избранное для тебя и даёт твой портрет посторонним. кроме того, если переставить неудобно люди будут лучше думать когда звездочку вешают. снова scarity
Aivean — 28.02.2025, 08:47
но тогда мы возвращаемся к тому, что их надо всегда переставлять,

это отменяет идеи с лейблами, возвращает проблему о том, как показывать исторические значения на постах/комментах
stormos — 28.02.2025, 08:47
нет же переставляются н последних
Aivean — 28.02.2025, 08:48
тогда не понял, как и когда они выдаются, и как это не приведет к пиле
или типа один раз в период выдавать всем сразу?
stormos — 28.02.2025, 08:52
ты ставишь звездочку, можешь поставить х*карма, те которые поставил меньше периода назад можно переставить
вернее снять
и она в копилке
@Aivean хорошее же решение?
Aivean — 28.02.2025, 08:58
можешь поставить х*карма
за период? всего?
stormos — 28.02.2025, 09:00
когда звездочка становится старше периода она возвращается в копилку. не снимается, просто +1 в окпилке
Aivean — 28.02.2025, 09:00
это выглядит изоморфным "постепенно выдавать звезды всем, с капом на накопление"
просто описано по-другому
stormos — 28.02.2025, 09:01
да
Aivean — 28.02.2025, 09:02
т.е. я за это как механизм, а описание можно обсудить
как понятнее пользователям будет
stormos — 28.02.2025, 09:06
важно что консенсус по механизму.
предлагаю считать вопрос решенным если в до воскр ничего не всплывет
stormos — Yesterday at 06:40
принято значит.
надо решить может ли юзернейм поставить несколько своих звездочек одному посту. как мне кажется может, особенно если будут категории.
как считаются и отображаются звездочки, чисто за пост или за пост и его коменты.
отсюда как делаются лидерборды
и где УХ снятия звездочки в профиле или всплывает
Aivean — Yesterday at 16:50
сегодня еще подумал, и предлагаю следующее:

три категории: "🌟 звездочка", "📰 заметка", "🔖 закладка"


в чем их различие:

🌟 звездочка — положительная, стоит токен, номинирует на премию, показывается в лидербордах, выделяет коммент (рамкой?)

📰 заметка — для других, нейтральная, стоит токен, не номинирует на премию, не показывается в лидербордах, но можно посмотреть заметки по отдельной сущности (коммент/пост) или все заметки по всем сущностям юзера (и самому юзеру)

аналог заметок с лепры, с разницей, что они публичны, и могут быть привязаны не только к юзеру, но и к посту/комменту

🔖 закладка — для себя, бесплатная, не номинирует на премию, не показывается в лидербордах, закладки публичны, но отображаются на сущности (пост, коммент, человек) только для автора, остальные же могут видеть твоих закладок у тебя в профиле (но не о тебе)


отличие заметки от закладки:
заметка для других
закладка для себя

все эти категории смогут шарить между собой:
UX для установки / снятия / изменения
storage
имплементацию лент
на комментарии / посте можно показывать счетчики для всех трех или только для звезд, надо посмотреть, как лучше, чтобы без перегруза
stormos — Yesterday at 21:54
хорошая идея.
stormos — Yesterday at 22:02
вернее это звёздочки и еще это две хорошие независимые идеи
Aivean — Yesterday at 22:17
у меня в голове там 80% функционала реюзаается
stormos — Today at 07:34
это да. с закладкой не понял ее визибилити. все видят мои закладки,  но посмотреть у кого я в закладках нельзя. так?
можно ли поставить две+ звездочки, звездочку и заметку, две+ заметки?
больше одной закладки смысла не имеет, но можно ли ее добавить к заметкам/звездочкам?  если закладки бесплатные их бесконечно много,  так?
по лидербордам. сразу делаем только один? по сумме звездочек выданным за период  юзернейму его постам и комментариям?
Aivean — Today at 09:35
с закладкой не понял ее визибилити. все видят мои закладки,  но посмотреть у кого я в закладках нельзя. так?
да. это не фундаментальное ограничение (можно скриптом собрать все закладки всех людей), но это направит пользователей использовать закладки и заметки по назначению

можно ли поставить две+ звездочки, звездочку и заметку, две+ заметки?
я думаю, ставить несколько звездочек имеет смысл, несколько заметок или звездочку + заметку не имеет, закладку можно вставить всегда, и только одну. тут вопрос, в основном, в UX

если закладки бесплатные их бесконечно много,  так?
да

по лидербордам. сразу делаем только один? по сумме звездочек выданным за период  юзернейму его постам и комментариям?
да
можно еще подумать, стоит ли сделать "закладки" полностью приватными (и шифрованными). хотя, тогда поиск по ним будет нетривиально сделать
stormos — Today at 11:24
если человеку нужна приватная закладка,  может просто сохранить в браузере