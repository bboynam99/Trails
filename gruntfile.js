module.exports = function (grunt) {
    grunt.initConfig({
    uglify: {
        files: { 
            src: 'clientDev/*.js',
            dest: 'client/js/',
            expand: true,
            flatten: true,
            ext: '.js'
        }
    },
    watch: {
        js:  { files: 'clientDev/*.js', tasks: [ 'uglify' ] },
    }
});

// load plugins
grunt.loadNpmTasks('grunt-contrib-watch');
grunt.loadNpmTasks('grunt-contrib-uglify');

// register at least this one task
grunt.registerTask('default', [ 'uglify' ]);


};
