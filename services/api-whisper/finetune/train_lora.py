"""
Khmer Whisper PEFT LoRA Fine-Tuning Script
Designed for Google Colab (T4 / A100 GPU) or any PyTorch CUDA environment.

Cost: ~$0 (Google Colab Free T4) or ~$0.25/hr (RunPod RTX 3090/4090)
Memory: < 8GB VRAM with QLoRA 8-bit or 16-bit LoRA.

Usage:
  python train_lora.py \
    --model_name_or_path "openai/whisper-small" \
    --dataset_path "./dataset_prepared" \
    --output_dir "./khmer_whisper_lora" \
    --num_train_epochs 10 \
    --learning_rate 1e-3 \
    --batch_size 8
"""

import os
import torch
import dataclasses
from typing import Any, Dict, List, Union
from datasets import load_dataset, Audio
from transformers import (
    WhisperFeatureExtractor,
    WhisperTokenizer,
    WhisperProcessor,
    WhisperForConditionalGeneration,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
)
from peft import (
    LoraConfig,
    get_peft_model,
    PeftModel,
    TaskType
)
import evaluate

def train(
    model_id: str = "openai/whisper-small",
    dataset_dir: str = "./dataset_prepared",
    output_dir: str = "./khmer_whisper_lora",
    epochs: int = 10,
    learning_rate: float = 1e-3,
    batch_size: int = 8,
    gradient_accumulation_steps: int = 2
):
    print("=" * 60)
    print(f"Starting Khmer Whisper LoRA Fine-Tuning on: {model_id}")
    print(f"Dataset path: {dataset_dir}")
    print(f"Output directory: {output_dir}")
    print("=" * 60)

    # 1. Load Processor, Tokenizer, Feature Extractor
    # Set language to Khmer ('km') and task to 'transcribe'
    feature_extractor = WhisperFeatureExtractor.from_pretrained(model_id)
    tokenizer = WhisperTokenizer.from_pretrained(model_id, language="Khmer", task="transcribe")
    processor = WhisperProcessor.from_pretrained(model_id, language="Khmer", task="transcribe")

    # 2. Load and Prepare Local Dataset
    dataset = load_dataset("audiofolder", data_dir=dataset_dir)
    # Cast audio column to 16kHz
    dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

    def prepare_sample(batch):
        audio = batch["audio"]
        # Extract log-mel spectrogram features
        batch["input_features"] = feature_extractor(
            audio["array"],
            sampling_rate=audio["sampling_rate"]
        ).input_features[0]

        # Tokenize target Khmer sentence
        batch["labels"] = tokenizer(batch["sentence"]).input_ids
        return batch

    print("Preprocessing audio samples and generating log-Mel features...")
    dataset = dataset.map(prepare_sample, remove_columns=dataset.column_names["train"], num_proc=1)

    # Split train/eval if dataset is sufficient
    if len(dataset["train"]) > 10:
        split_dataset = dataset["train"].train_test_split(test_size=0.15, seed=42)
        train_data = split_dataset["train"]
        eval_data = split_dataset["test"]
    else:
        train_data = dataset["train"]
        eval_data = dataset["train"]

    # 3. Data Collator for Whisper
    @dataclasses.dataclass
    class DataCollatorSpeechSeq2SeqWithPadding:
        processor: Any

        def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
            input_features = [{"input_features": f["input_features"]} for f in features]
            batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")

            label_features = [{"input_ids": f["labels"]} for f in features]
            labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")

            # Replace padding with -100 so CrossEntropy loss ignores it
            labels = labels_batch["input_ids"].masked_fill(
                labels_batch.attention_mask.ne(1), -100
            )

            # If bos token is present in label start, slice it
            if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
                labels = labels[:, 1:]

            batch["labels"] = labels
            return batch

    data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

    # 4. Load Pretrained Whisper Model
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading Base Model on device: {device}")

    model = WhisperForConditionalGeneration.from_pretrained(
        model_id,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        device_map="auto" if device == "cuda" else None
    )

    # Disable cache for gradient checkpointing
    model.config.use_cache = False
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    # 5. Apply LoRA (Low-Rank Adaptation)
    # LoRA injects trainable rank decomposition matrices into Attention projections
    # Only ~1% of parameters are trained!
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.FEATURE_EXTRACTION
    )

    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 6. Metric Evaluation (CER - Character Error Rate)
    cer_metric = evaluate.load("cer")

    def compute_metrics(pred):
        pred_ids = pred.predictions
        label_ids = pred.label_ids

        # Replace -100 with pad_token_id
        label_ids[label_ids == -100] = tokenizer.pad_token_id

        pred_str = tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
        label_str = tokenizer.batch_decode(label_ids, skip_special_tokens=True)

        cer = 100 * cer_metric.compute(predictions=pred_str, references=label_str)
        return {"cer": cer}

    # 7. Training Arguments
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        learning_rate=learning_rate,
        warmup_steps=50,
        num_train_epochs=epochs,
        evaluation_strategy="epoch" if len(eval_data) > 0 else "no",
        save_strategy="epoch",
        fp16=(device == "cuda"),
        per_device_eval_batch_size=batch_size,
        generation_max_length=225,
        logging_steps=10,
        remove_unused_columns=False,
        label_names=["labels"],
        report_to=["tensorboard"]
    )

    trainer = Seq2SeqTrainer(
        args=training_args,
        model=model,
        train_dataset=train_data,
        eval_dataset=eval_data,
        data_collator=data_collator,
        tokenizer=processor.feature_extractor,
    )

    print("Beginning Training...")
    trainer.train()

    print(f"Training completed! Saving LoRA weights to {output_dir}")
    model.save_pretrained(output_dir)
    processor.save_pretrained(output_dir)
    print("Done! You can now merge the adapter and convert to CTranslate2.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_name_or_path", default="openai/whisper-small")
    parser.add_argument("--dataset_path", default="./dataset_prepared")
    parser.add_argument("--output_dir", default="./khmer_whisper_lora")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    train(
        model_id=args.model_name_or_path,
        dataset_dir=args.dataset_path,
        output_dir=args.output_dir,
        epochs=args.epochs,
        learning_rate=args.lr,
        batch_size=args.batch_size
    )

