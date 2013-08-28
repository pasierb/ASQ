var lib            = require('../../../lib')
  , dustHelpers    = lib.dustHelpers
  , appLogger      = lib.logger.appLogger
  , asqParser      = lib.asqParser
  , asqRenderer    = lib.asqRenderer
  , fsUtils        = lib.fsUtils
  , model          = require('../../../models')
  , slideshowModel = model.slideshowModel
  , questionModel  = model.questionModel
  , AdmZip         = require('adm-zip')
  , moment         = require('moment')
  , path           = require('path')
  , pfs            = require('promised-io/fs')
  , _              = require('underscore')
  , when           = require('when');

function listPresentations(req, res) {
  appLogger.debug('list presentations');
  if (req.params.user === req.user.name) {
    var Slideshow = db.model('Slideshow', schemas.slideshowSchema);
    Slideshow.find({
      owner : req.user._id
    }, '_id title course lastSession lastEdit',
    function processPresentations(err, slides) {
      if (err) {
        throw err;
      }
      var slidesByCourse = null; //to evaluate as false in dustjs

      if (slides && slides.length > 0) {
        slidesByCourse = {};
        for (var i = 0; i < slides.length; i++) {
          var slideshow = slides[i].toJSON();
          if (!slidesByCourse.hasOwnProperty(slideshow.course)) {
            slidesByCourse[slideshow.course] = [];
          }
          slideshow.lastEdit = moment( slideshow.lastEdit)
              .format('DD.MM.YYYY HH:mm');
          slideshow.lastSession = moment( slideshow.lastSession)
              .format('DD.MM.YYYY HH:mm');
          slidesByCourse[slideshow.course].push(slideshow);
        }
      }

      var type = req.query.type && /(succes|error|info)/g.test(req.query.type) 
          ? 'alert-' + req.query.type : '';

      res.render('user', {
        slidesByCourses: slidesByCourse,
        JSONIter : dustHelpers.JSONIter,
        username : req.user.name,
        host : appHost,
        port : app.get('port'),
        id : req.user.current,
        alert : req.query.alert,
        type : type,
        session : req.user.current
      });
    });
  } else {
    res.redirect('/user/' + req.user.name + '/');
  }

}

function uploadPresentation(req, res) {
  //STEPS TO CREATE A NEW SLIDESHOW

  // 1) create new Slideshow model
  var Slideshow = db.model('Slideshow')
  , slideShowFileHtml
  , slideShowQuestions
  , parsedQuestions
  , parsedStats;

  var newSlideshow = new Slideshow({
    title : req.files.upload.name,
    owner : req.user._id
  });

  // 2) unzip files
  var folderPath = app.get('uploadDir') + '/' + newSlideshow._id;
  var zip = new AdmZip(req.files.upload.path);
  zip.extractAllTo(folderPath);

  //3) make sure at least one html exists
  fsUtils.getFirstHtmlFile(folderPath)
    .tap(function(filePath){
      newSlideshow.originalFile = filePath;
      appLogger.debug('will use ' + filePath + ' for main presentation file...');
    })
    .then(
      function(filePath){
        return pfs.readFile(filePath);     
    })
    //4) parse questions
    .then(    
      function(file) {
        slideShowFileHtml = file;
        appLogger.debug('parsing main .html file for questions...');
        return asqParser.parse(slideShowFileHtml);
    })
    //5) create new questions for database
    // TODO: create questions only if they exist
    .then(
      function(parsed){
        parsedQuestions = parsed.questions;
        parsedStats = parsed.stats;
        return questionModel.create(parsedQuestions)
    })
    //6) render questions inside to slideshow's html into memory
    .then(
      function(dbQuestions){
        appLogger.debug('questions successfully parsed');

        //copy objectIDs created from mongoose
        _.each(parsedQuestions, function(parsedQuestion, index){
          parsedQuestion.id = dbQuestions[index].id;

           // push questions mongo ids to corresponding questions
          _.each(parsedStats, function(parsedStat){
            if(parsedStat.questionHtmlId == parsedQuestion.htmlId){
              parsedStat.questionId = parsedQuestion.id;
            }
          });
        });

        //hold reference to the db questions
        slideShowQuestions = dbQuestions;

        return when.all([
          asqRenderer.render(slideShowFileHtml, parsedQuestions, "teacher")
          //,
          //asqRenderer.render(slideShowFileHtml, parsedQuestions, "student")
          ]);
    })
    //7) store new html with questions to file
    .then(
      function(newHtml){
        appLogger.debug('presenter and audience files rendered in memory successfully');
        var fileNoExt =  folderPath + '/' + path.basename(newSlideshow.originalFile, '.html');
        newSlideshow.teacherFile =  fileNoExt + '.asq-teacher.dust';
        newSlideshow.studentFile =  fileNoExt + '.asq-student.dust';
        
        var filePromises = [
          pfs.writeFile(newSlideshow.teacherFile, newHtml[0]),
          pfs.writeFile(newSlideshow.studentFile, newHtml[1])
         ];

        return  require("promised-io/promise").all(filePromises);

    })
    //8) add questions to slideshow and persist
    .then(
      function(){
        newSlideshow.questions = slideShowQuestions
        // remember: parsedQuestions and parsedStats now have the question ObjectID
        // created when the mongo questions were created
        newSlideshow.questionsPerSlide = slideshowModel.createQuestionsPerSlide(parsedQuestions)
        newSlideshow.statsPerSlide = slideshowModel.createStatsPerSlide(parsedStats)

        return newSlideshow.saveWithPromise();
    })
    //9) remove zip folder
    .then(
      function(doc){
        appLogger.debug('new slideshow saved to db');
        //create thumbs
        appLogger.debug('creating thumbnails')
        createThumb(newSlideshow);
        return pfs.unlink(req.files.upload.path);         
    })
    //10) update slideshows for user
    .then(function(){
      var User = db.model('User');
          return User.findByIdAndUpdate(req.user._id, { $push: {slides : newSlideshow._id } }).exec();
    })
    //11) redirect to user profile page
    .then(
      function(user){
      appLogger.debug('upload zip file unlinked');
      appLogger.info('upload complete!');
      res.redirect('/user/')
    },

      // Error handling for all the above promises
      function(err){
        appLogger.error("in upload.js: " + err.toString(), {error: err});
        pfs.unlink(req.files.upload.path).then(res.redirect('/user/'));
    });
}

function getPresentation(req, res) {
  if (req.params.user === req.user.name) {
    var id = req.params.id;
    var Slideshow = db.model('Slideshow', schemas.slideshowSchema);

    Slideshow.findById(id, function(err, slideshow) {
      if(slideshow){
        res.sendfile(slideshow.originalFile);
      
      }else{
        res.send(404, "Slideshow not found");
      }
    });
  }
  res.send(401, 'You cannot see this slideshow');

}

function updatePresentation(req, res) {
  appLogger.error('NOT IMPLEMENTED: Updating a presentation is not supported.');
  res.send(405, 'Cannot update a presentation so far...');
}

function deletePresentation(req, res) {
  if (req.params.user === req.user.name) {
    var User      = db.model('User')
      , Slideshow = db.model('Slideshow');

    Slideshow.findOne({_id: req.params.id, owner: req.user._id}).exec()
    .then(
    function(slideshow){
      return slideshow.remove().exec()
    })
    .then(
    function(){
      res.redirect('/' + req.user.name +
        '/presentations?alert=Slideshow deleted&type=succes');
    },
    function(err){
      res.redirect('/' + req.user.name +
        '/presentations?alert=Something went wrong. The Great ASQ Server said: '
        + err.toString() + '&type=error');
      throw err;
      
    });
  }
}


module.exports = {
  listPresentations  : listPresentations,
  uploadPresentation : uploadPresentation,
  getPresentation    : getPresentation,
  updatePresentation : updatePresentation,
  deletePresentation : deletePresentation
}