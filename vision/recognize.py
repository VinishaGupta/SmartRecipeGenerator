import os



import sys
import json
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision.models import mobilenet_v2


# Silence PyTorch download output
os.environ["TORCH_HOME"] = os.path.expanduser("~/.cache/torch")
sys.stdout = sys.__stdout__
# Load model
model = mobilenet_v2(pretrained=True)
model.eval()

# Load ImageNet labels
LABELS_URL = "https://raw.githubusercontent.com/pytorch/hub/master/imagenet_classes.txt"
labels = [line.strip() for line in open(__file__.replace("recognize.py", "imagenet_classes.txt"))]

MIN_CONFIDENCE = 0.08
IMAGENET_TO_INGREDIENT = {
    "head cabbage": "cabbage",
    "broccoli": "broccoli",
    "cauliflower": "cauliflower",
    "zucchini": "zucchini",
    "spaghetti squash": "zucchini",
    "acorn squash": "zucchini",
    "butternut squash": "zucchini",
    "cucumber": "cucumber",
    "bell pepper": "bell pepper",
    "mushroom": "mushroom",
    "banana": "banana",
    "orange": "orange",
    "lemon": "lemon",
    "pineapple": "pineapple",
    "strawberry": "strawberry",
}
SUPPORTED_INGREDIENT_LABELS = {
    "head cabbage",
    "cucumber",
    "zucchini",
    "spaghetti squash",
    "acorn squash",
    "butternut squash",
    "bell pepper",
    "banana",
    "orange",
    "lemon",
    "pineapple",
    "strawberry",
    "broccoli",
    "cauliflower",
    "mushroom",
}

# Image path passed from Node
image_path = sys.argv[1]

# Preprocess image
img = Image.open(image_path).convert("RGB")
preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])
input_tensor = preprocess(img).unsqueeze(0)

# Predict
with torch.no_grad():
    outputs = model(input_tensor)
    probs = torch.nn.functional.softmax(outputs[0], dim=0)

# Get top predictions and keep only confident ingredient labels.
top_probs, top_idxs = probs.topk(5)

results = []
for prob, idx in zip(top_probs, top_idxs):
    label = labels[idx]
    if label in SUPPORTED_INGREDIENT_LABELS and float(prob) >= MIN_CONFIDENCE:
        ingredient = IMAGENET_TO_INGREDIENT.get(label, label)
        if ingredient not in results:
            results.append(ingredient)

# Return JSON to Node
sys.stdout.write(json.dumps(results))
sys.stdout.flush()

