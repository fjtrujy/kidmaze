#!/usr/bin/env python3
"""Train Kid Maze's compact handwritten-symbol classifier on EMNIST Balanced.

Development-only dependencies:
  python -m pip install torch torchvision onnx

The browser never ships Python or PyTorch. Only the exported ONNX model is
deployed. Training filters EMNIST to the exact digits and uppercase letters
used by Kid Maze, which keeps the model small and avoids unrelated classes.
"""

import json
from pathlib import Path

from PIL import Image
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from torchvision.datasets import EMNIST


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = PROJECT_ROOT / "src" / "game" / "symbol-model-config.json"
MODEL_PATH = PROJECT_ROOT / "public" / "models" / "kidmaze-symbols.onnx"
CONFLICTS_PATH = PROJECT_ROOT / "src" / "game" / "letter-conflicts.json"
DATA_ROOT = PROJECT_ROOT / ".cache" / "emnist"
PAIR_CONFLICT_ACCURACY = 0.97

config = json.loads(CONFIG_PATH.read_text())
LABELS = config["labels"]
EMNIST_CLASSES = EMNIST.classes_split_dict["balanced"]
SOURCE_LABELS = [EMNIST_CLASSES.index(label) for label in LABELS]
REMAP = {source: target for target, source in enumerate(SOURCE_LABELS)}


class NaturalOrientation:
    """Convert EMNIST's stored matrix orientation to natural handwriting."""

    def __call__(self, image):
        return image.transpose(Image.Transpose.TRANSPOSE)


class FilteredEMNIST(Dataset):
    def __init__(self, train: bool, transform):
        self.base = EMNIST(
            DATA_ROOT,
            split="balanced",
            train=train,
            download=True,
            transform=transform,
        )
        self.indices = [
            index
            for index, label in enumerate(self.base.targets.tolist())
            if label in REMAP
        ]

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, index):
        image, label = self.base[self.indices[index]]
        return image, REMAP[int(label)]


class SymbolCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 3 * 3, 64),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(64, len(LABELS)),
        )

    def forward(self, image):
        return self.classifier(self.features(image))


def evaluate(model, loader, device):
    model.eval()
    correct = 0
    total = 0
    per_correct = [0] * len(LABELS)
    per_total = [0] * len(LABELS)

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)
            predicted = model(images).argmax(1)
            correct += (predicted == labels).sum().item()
            total += labels.numel()
            for index in range(len(LABELS)):
                mask = labels == index
                per_total[index] += mask.sum().item()
                per_correct[index] += ((predicted == labels) & mask).sum().item()

    return correct / total, [
        per_correct[index] / per_total[index] for index in range(len(LABELS))
    ]


def evaluate_letter_pairs(model, loader, device):
    model.eval()
    all_logits = []
    all_labels = []
    with torch.no_grad():
        for images, labels in loader:
            all_logits.append(model(images.to(device)).cpu())
            all_labels.append(labels)

    logits = torch.cat(all_logits)
    labels = torch.cat(all_labels)
    letter_indices = [index for index, label in enumerate(LABELS) if label.isalpha()]
    pair_scores = []

    for left_offset, left_index in enumerate(letter_indices):
        for right_index in letter_indices[left_offset + 1 :]:
            mask = (labels == left_index) | (labels == right_index)
            pair_logits = logits[mask][:, [left_index, right_index]]
            pair_labels = labels[mask]
            predicted = pair_logits.argmax(1)
            expected = (pair_labels == right_index).long()
            accuracy = (predicted == expected).float().mean().item()
            pair_scores.append((accuracy, LABELS[left_index], LABELS[right_index]))

    pair_scores.sort()
    conflicts = [
        [left, right]
        for accuracy, left, right in pair_scores
        if accuracy < PAIR_CONFLICT_ACCURACY
    ]
    return pair_scores, conflicts


def main():
    torch.manual_seed(2026)
    natural = NaturalOrientation()
    train_transform = transforms.Compose(
        [
            natural,
            transforms.RandomAffine(
                degrees=12,
                translate=(0.10, 0.10),
                scale=(0.88, 1.12),
                shear=6,
                fill=0,
            ),
            transforms.ToTensor(),
            transforms.Normalize((config["mean"],), (config["std"],)),
        ]
    )
    test_transform = transforms.Compose(
        [
            natural,
            transforms.ToTensor(),
            transforms.Normalize((config["mean"],), (config["std"],)),
        ]
    )

    train_data = FilteredEMNIST(True, train_transform)
    test_data = FilteredEMNIST(False, test_transform)
    train_loader = DataLoader(train_data, batch_size=256, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_data, batch_size=512, shuffle=False, num_workers=0)

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    model = SymbolCNN().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.02)

    print(f"Training {len(train_data)} samples on {device}: {', '.join(LABELS)}")
    for epoch in range(1, 7):
        model.train()
        running_loss = 0.0
        seen = 0
        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * labels.numel()
            seen += labels.numel()

        accuracy, per_class = evaluate(model, test_loader, device)
        scores = " ".join(
            f"{LABELS[index]}:{score * 100:.1f}%"
            for index, score in enumerate(per_class)
        )
        print(
            f"epoch {epoch}: loss={running_loss / seen:.4f} "
            f"test={accuracy * 100:.2f}%\n{scores}"
        )

    pair_scores, conflicts = evaluate_letter_pairs(model, test_loader, device)
    print("Worst letter pairs:")
    for accuracy, left, right in pair_scores[:12]:
        marker = " conflict" if accuracy < PAIR_CONFLICT_ACCURACY else ""
        print(f"  {left}/{right}: {accuracy * 100:.1f}%{marker}")
    CONFLICTS_PATH.write_text(json.dumps(conflicts, indent=2) + "\n")
    print(
        f"Wrote {CONFLICTS_PATH.relative_to(PROJECT_ROOT)} "
        f"with {len(conflicts)} pairs below {PAIR_CONFLICT_ACCURACY * 100:.0f}%"
    )

    model = model.to("cpu").eval()
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.zeros(1, 1, config["imageSize"], config["imageSize"])
    torch.onnx.export(
        model,
        dummy,
        MODEL_PATH,
        input_names=["input"],
        output_names=["logits"],
        opset_version=17,
        dynamo=False,
    )
    print(f"Wrote {MODEL_PATH.relative_to(PROJECT_ROOT)} ({MODEL_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
