## aws-s3-lambda-crop-n-resize

### Installation
```bash
$npm install async gm
```
### Configure

```bash
$ cp config.json.sample config.json
```

Sample config.json

```json
{
	"dstBucket": "dslambdaresize",
	"thumbs":[
		{"folder":"square", "type":"thumbnail", "geometry":"500x500"         },
		{"folder":"large" , "type":"resize",    "width":"900", "height":"900"},
		{"folder":"medium", "type":"resize",    "width":"600"                },
		{"folder":"small" , "type":"resize",                   "height":"300"}
	]
}
```
- `dstBucket`: destination bucket (source bucket is determined by trigger in lambda)
- `thumbs`: various size and shares
	- `folder`: must be unique
	- `type`: processing mode
		- `thumbnail`: resize and center-crops and image
		- `resize`: simple reduce in size preserving aspect ratio of original
	- `geometry`: required for 'thumbnail'
	- `height` and `width`: at least one is required for `resize` mode


### Deploy
- zip content of the folder
- upload as lambda function
- maker sure both dstBucket exists