import React, { useState } from 'react'
import './FeedbackRating.css'

const FeedbackRating = ({ maxStars, question }) => {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')

  const handleRatingClick = (value) => {
    setRating(value)
  }

  const handleCommentChange = (e) => {
    setComment(e.target.value)
  }

  return (
    <div className="feedback-rating-container">
      <div className="question">{question}</div>
      <div className="stars">
        {[...Array(maxStars)].map((_, index) => {
          const starValue = index + 1
          return (
            <span
              key={index}
              className={`star ${starValue <= (hover || rating) ? 'filled' : ''}`}
              onClick={() => handleRatingClick(starValue)}
              onMouseEnter={() => setHover(starValue)}
              onMouseLeave={() => setHover(rating)}
            >
              &#9733
            </span>
          )
        })}
      </div>
      <div className="comment-section">
        <textarea
          value={comment}
          onChange={handleCommentChange}
          placeholder="Leave a comment..."
        ></textarea>
      </div>
    </div>
  )
}

export default FeedbackRating
