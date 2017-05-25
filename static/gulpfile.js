//2016/2/11 Mike
var gulp = require('gulp'),
    plumber = require('gulp-plumber'),
    sass = require('gulp-sass'),
    watch = require('gulp-watch'),
    minifycss = require('gulp-minify-css'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    sourcemaps = require('gulp-sourcemaps'),
        connect = require('gulp-connect'),
    del = require('del');



gulp.task('connect', function() {
    connect.server({
        root: './',
        livereload: true
    });
});

//重置
gulp.task('clean', function() {
    return del(['build']);
});

// Sass編譯任務
gulp.task('sass', ['clean'], function() {
    return gulp.src(['./scss/**.scss'])
        .pipe(sourcemaps.init())
        .pipe(plumber())
        .pipe(sass({
                // outputStyle: 'nested'
                outputStyle: 'compressed'
            })
            .on('error', sass.logError))
        .pipe(sourcemaps.write())
        .pipe(minifycss({ keepSpecialComments: 1 }))
        .pipe(gulp.dest('./css/'))
});

//Js壓縮任務
gulp.task('mizjs', ['clean'], function() {
    return gulp.src(['./prejs/**.js'])
        //.pipe(uglify({output: {comments: /^!|@preserve|@license|@cc_on/i}}))
        .pipe(sourcemaps.init())
        .pipe(concat('mizUI.js'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('./js/'));
});




//任務"css"負責'sass'這個版型相關的編譯任務
gulp.task('css', ['sass']);
//任務"mizjs"負責'js壓縮任務
gulp.task('js', ['mizjs']);

gulp.task('default', ['connect','css','js' ], function() {
    gulp.watch('./scss/**/**.scss', ['css']);
    gulp.watch('./prejs/**/**.js', ['js']);
});



