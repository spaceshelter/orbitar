# Token Marker System Specification for Orbitar

## 1. Core Mechanism

### 1.1 Token Allocation
- Each full-status community member receives 3-4 tokens per month
- Tokens accumulate gradually throughout the month
- Maximum token accumulation capped at 4 tokens
- Optional: Maximum accumulation cap (1-4) may scale with user karma, while allocation rate remains equal for all users

### 1.2 Token Properties
- Tokens can be applied to: posts, comments, or user profiles
- Once placed, tokens are permanent and cannot be removed
- A user can replace their own token with another token of the same type
- Each token can include an optional short text annotation
- Tokens have visual categories/types (similar to emoji reactions but with specific community significance)
  - current types: Star (🌟), Note (📰), Bookmark (🔖)

## 2. User Experience

### 2.1 Placement and Management
- Users can see their available token count in their profile
- Interface shows which tokens were placed within the "returnable period"
- Recently placed tokens (less than a defined period old) can be returned to the user's available pool
  - by marking as "removed" in DB
- User profiles display a history of tokens placed by the user

### 2.2 Visualization
- Tokens are visually represented on content with distinct iconography (`TokenCounters` component)
- Content shows a counter for each token type received
- Clicking on a token counters open a popup/modal (similar to `RatingList` component) with the list of tokens of all types placed by all users:
    - Token type
    - When it was placed
    - Who placed it
    - Any attached text annotation
    
## 3. Token Types

Three distinct marker types with different purposes:

### 3.1 Star (🌟)
- Purpose: Positive recognition, nomination for awards
- Cost: Consumes one token
- Visibility: Public, displayed prominently
- Features:
    - Counts toward leaderboards
    - Visually highlights the marked content (with border or effect)
    - Nominates for potential awards/recognition

### 3.2 Note (📰)
- Purpose: Public annotation or commentary
- Cost: Consumes one token
- Visibility: Public, displayed secondarily
- Features:
    - Does not count toward leaderboards or nominations
    - Allows public annotation of content or users
    - Similar to legacy Leprosorium notes, but public

### 3.3 Bookmark (🔖)
- Purpose: Personal reference
- Cost: Free (does not consume tokens)
- Visibility: The bookmark itself is only visible to its creator on the content
- Features:
    - Others can see your bookmarked content in your profile
    - Cannot see who has bookmarked a specific piece of content
    - Unlimited quantity (no token cost)

## 4. Technical Implementation

### 4.1 Data Storage
- Token records must store:
    - Token type (Star/Note/Bookmark) (int, enum in the code)
    - Placed count (int)
    - Placement timestamp
    - Removal timestamp (nullable)
    - Creator ID (voter_id)
    - Target ID (post/comment/user) (user_id, post_id, comment_id)nullable
      - nullable, with foreign key to the target table
    - Optional text annotation (varchar 256)
- indexes:
  - placement timestamp
  - unique index on (creator_id, target_id, token_type)

Additionally, token counters are cached directly on the target content (post/comment/user). 
This cache is updated on token placement/removal.


### 4.2 Limits
- Token accrual rate: Approximately 1 token per 7-10 days
- Token cap prevents hoarding
  - determined non-linearly from the user's effectiveKarma
- Users can place multiple tokens on a single content item (if they have available tokens)
  - only makes sense for stars


## 6. UI/UX Considerations

### 6.1 Token Placement Interface
- Simple, accessible UI for placing/replacing tokens
- Clear visualization of token availability and recent placements
- Token type selection with visual distinction

### 6.2 Content Display
- Non-intrusive token display on posts/comments (`TokenCounters` component)
- Clear distinction between Stars, Notes, and Bookmarks
- Intuitive hover/click interactions for additional information
