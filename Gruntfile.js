/**
  @fileoverview main Grunt task file
**/
'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    //mocha tests
    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/**/*.js']
      }
    },

    //browserify
    browserify: {
      vendor:{
        src: ['client/js/vendor/vendor-entry.js'],//, 'jquery-1.10.2.js', 'bootstrap.js'],
        dest: 'public/js/vendor.js',
        options:{
          alias: 'client/js/vendor/jquery-1.10.2.js:jQuery',
          shim:{
            bootstrap:{
              path: 'client/js/vendor/bootstrap.js'
              , exports: null
              , depends: {jQuery:'jQuery'}
            } 
          }
       }
      },
      client:{
        src: ['client/js/client.js'],
        dest: 'public/js/asq-client.js',
        debug: true,
        options:{
          alias: 'client/js/client-socket.js:clientSocket',
          external: ["jQuery"]
       }
      },
      presenter: {
        src: ['client/js/presenter.js'],
        dest: 'public/js/asq-presenter.js',
        debug: true,
        options: {
          shim: {
            impressAdmin: {path: 'client/js/impress-presenter.js', exports: 'impress'}
          }
        }
      },
      viewer: {
        src: ['client/js/viewer.js'],
        dest: 'public/js/asq-viewer.js',
        debug: true,
        options: {
          shim: {
            impressAdmin: {path: 'client/js/impress-viewer.js', exports: 'impress'}
          }
        }
      },
    },

    //jshint
    jshint: {
      all: ['Gruntfile.js'
          , 'client/js/**/*.js'
          , '!client/js/vendor/**/*.js'
          , 'test/**/*.js']
    },

    //uglify
    uglify: {
      options: {
        screw_ie8 : true,
        mangle:false,
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        files: {
          'public/js/vendor.min.js' : ['public/js/vendor.js'],
          'public/js/asq-presenter.min.js' : ['public/js/asq-presenter.js'],
          'public/js/asq-viewer.min.js' : ['public/js/asq-viewer.js']
        }
      }
    },

    less: {
      development: {
        options: {
          paths: ["client/less"]
        },
        files: {
          "public/css/login.css": "client/less/login.less",
          "public/css/logoAnim.css": "client/less/logoAnim.less",
          "public/css/phone.css": "client/less/phone.less",
          "public/css/style.css": "client/less/style.less"
        }
      },
      production: {
        options: {
          paths: ["client/less"],
          yuicompress: true
        },
        files: {
          "public/css/login.css": "client/less/login.less",
          "public/css/logoAnim.css": "client/less/logoAnim.less",
          "public/css/phone.css": "client/less/phone.less",
          "public/css/style.css": "client/less/style.less"
        }
      }
    },

    //watch
    watch: {
      options:{
        livereload: true
      },
      client: {
        files: ['client/js/*.js'],
        tasks: ['browserify:client'],
        options: {
          // spawn: false,
          interrupt: true
        },
      },
    }
  });

  // Default task(s).
  grunt.registerTask('default', ['mochaTest', 'jshint', 'browserify', 'uglify']);

  //npm tasks
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  //load external taks
  grunt.loadTasks('./tasks');

};
