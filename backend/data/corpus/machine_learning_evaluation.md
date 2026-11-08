# Machine Learning Evaluation & The RAG Triad

## 1. Classification Metrics Overview
In classification problems, predictions are evaluated against true labels using four basic outcomes:
- **True Positive (TP)**: Correctly predicted positive event.
- **True Negative (TN)**: Correctly predicted negative event.
- **False Positive (Type I Error)**: Incorrectly predicted positive event.
- **False Negative (Type II Error)**: Incorrectly predicted negative event.

### F1-Score
The F1-Score is the harmonic mean of precision and recall. It balances precision and recall when the class distribution is heavily skewed or imbalanced:
$$\text{F1} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$

### ROC-AUC (Area Under the Receiver Operating Characteristic Curve)
ROC-AUC measures the model's ability to discriminate between positive and negative classes across all possible classification thresholds. A random guess achieves an AUC of 0.50, whereas a perfect classifier achieves an AUC of 1.00.

---

## 2. The RAG Triad of Metrics
When evaluating a Retrieval-Augmented Generation (RAG) system, three core metrics define whether the pipeline is performing reliably:

1. **Context Relevance (Retrieval)**:
   Measures whether the retrieved chunks are relevant to the user query. If retrieval returns irrelevant context, the LLM will either fail to answer or suffer from the "lost in the middle" effect.

2. **Groundedness / Faithfulness (Hallucination Control)**:
   Measures whether every claim made in the generated answer can be strictly traced back to the retrieved context chunks. If an answer contains facts not present in the context, it is deemed unfaithful or hallucinated.

3. **Answer Relevance (Generation)**:
   Measures whether the final response directly addresses the user's initial question without drifting into tangential topics.
