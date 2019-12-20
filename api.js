'use strict';

const Homey = require('homey');

module.exports = [

  {
    method: 'GET',
    path: '/:getDeviceList',
    public: false,
		role: "owner",
    fn: function( args, callback ){
      const result = Homey.app.info_data;
      // callback follows ( err, result )
      callback( null, result );
      // access /?foo=bar as args.query.foo
    }
  }

]
