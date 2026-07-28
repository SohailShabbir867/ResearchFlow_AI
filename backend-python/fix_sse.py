import re

path = r'src/api.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace literal \n\n inside yield f"data: ..." strings with actual newline characters
# E.g. replace r"\n\n" with "\n\n"
fixed_content = content.replace(r"\\n\\n", r"\n\n")

print(f"Occurrences replaced: {content.count(r'\\n\\n')}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(fixed_content)
