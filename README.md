## aws-s3-lambda-crop-n-resize
Lambda function when triggered by an S3 PUT (configured in lambda triggers in AWS) automatically resizes images to "standar sizes" and place them in destination bucket (dsBucket).

### Dependencies
```bash
$ npm install async gm
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
	- `folder`: each entry must be unique, or you'll be overwriting the files
	- `type`: processing mode
		- `thumbnail`: resize and center-crops the image
		- `resize`: simple reduce in size preserving aspect ratio of original
	- `geometry`: required for `thumbnail` mode
	- `height` and `width`: at least one is required for `resize` mode


### Deploy
1. zip content of the folder
2. upload as lambda function
	* Lambda Config
		* Runtime: Node.js 4.3
		* Handler: index.handler
		* Memory: 1024MB
		* Timeout: 3 min
3. maker sure dstBucket exists

### Notes
* Large files (3+ MB) might cause problems. Try allocating more memory in Lambda.
* Start with 1024mb of ram and 2 minutes timeout, and read log to adjust
* Code based on [AWS tutorial](http://docs.aws.amazon.com/lambda/latest/dg/with-s3-example-deployment-pkg.html)
* Only handles jpg and png
