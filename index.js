// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm')
            .subClass({ imageMagick: true }); // Enable ImageMagick integration.
var util = require('util');
var fs   = require("fs");
var path = require("path");


// get reference to S3 client 
var s3 = new AWS.S3();
 
exports.handler = function(event, context) {

	// Load config.json
	var configPath = path.resolve(__dirname, "config.json");
	var config = JSON.parse(fs.readFileSync(configPath, { encoding: "utf8" }));	


	// Read options from the event.
	console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
	var srcBucket = event.Records[0].s3.bucket.name;
	var srcKey    = event.Records[0].s3.object.key;
	var dstBucket = config.dstBucket; //from config.json
	var dstKey    = srcKey;

	// Sanity check: validate that source and destination are different buckets.
	if (srcBucket == dstBucket) {
		console.error("Destination bucket must not match source bucket.");
		return;
	}

	// Infer the image type.
	var typeMatch = srcKey.match(/\.([^.]*)$/);
	if (!typeMatch) {
		console.error('unable to infer image type for key ' + srcKey);
		return;
	}
	var imageType = typeMatch[1];
	if (imageType != "jpg" && imageType != "png") {
		console.log('skipping non-image ' + srcKey);
		return;
	}

	var thumbs = config.thumbs; //from config.json


	var thumbs2 = thumbs;

	for (var i=0,  tot=thumbs2.length; i < tot; i++) {

		async.waterfall(
			[

				function download(next) {
					// Download the image from S3 into a buffer.
					s3.getObject(
						{
							Bucket: srcBucket,
							Key: srcKey
						},
						next
					);
				},

				function transform(response, next) {

					var current_thumb = thumbs.pop();


					if(current_thumb.type=='thumbnail'){

						if (typeof current_thumb.geometry == 'undefined') current_thumb.geometry = '960x540';

						console.log('Thumbnail '+ current_thumb.geometry);

						gm(response.Body)
						.command('convert')
						.out('-quality', 85)
						.out('-gravity', 'center')
						.out('-resize', current_thumb.geometry+'^')
						.out('-crop', current_thumb.geometry+'+0+0')
						.toBuffer(imageType, function(err, buffer) {
							if (err) {
								next(err);
							} else {
								next(null, response.ContentType, buffer, current_thumb.folder);
							}
						});

					} else if(current_thumb.type=='resize'){

						if (typeof current_thumb.width == 'undefined') current_thumb.width = null;
						if (typeof current_thumb.height == 'undefined') current_thumb.height = null;

						console.log('Resize '+ current_thumb.width + 'x' + current_thumb.height);

						gm(response.Body)
						.resize(current_thumb.width, current_thumb.height)
						.toBuffer(imageType, function(err, buffer) {
							if (err) {
								next(err);
							} else {
								next(null, response.ContentType, buffer, current_thumb.folder);
							}
						});
					}

				},

				function upload(contentType, data, folder, next) {
					// Stream the transformed image to a different S3 bucket.
					console.log('Uploading '+ folder + '/' + dstKey);
					s3.putObject(
						{
							Bucket: dstBucket,
							Key: folder + '/' + dstKey,
							Body: data,
							ContentType: contentType
						},
						next
					);
				}

			],

			function (err) {

				if (err) {
					console.error(
						'Unable to resize ' + srcBucket + '/' + srcKey +
						' and upload to ' + dstBucket + '/' + dstKey +
						' due to an error: ' + err
					);
				} else {
					console.log(
						'Successfully resized ' + srcBucket + '/' + srcKey +
						' and uploaded to ' + dstBucket + '/' + dstKey
					);
				}

				//callback(null, "message");
			}
		);


	}







};

