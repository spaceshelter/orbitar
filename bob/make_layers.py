import os, base64, json

layers = []
for folder in ['skin', 'body', 'hair', 'items', 'hats']:
    print(f'\t\t\t{folder}:')
    files = os.listdir(f'layers/{folder}')

    layer = []
    for fname in sorted(files, key=lambda x: int(x.split('_')[0])):
        with open(f'layers/{folder}/{fname}', 'rb') as f:
            bob64 = base64.b64encode(f.read()).decode('utf-8')
            layer.append(bob64)
        print(fname)
    layers.append(layer)

with open('layers.js', 'w') as f:
    f.write(f'module.exports.layers = {json.dumps(layers)};\n')
