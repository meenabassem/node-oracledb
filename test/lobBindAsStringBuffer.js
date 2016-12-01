/* Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * The node-oracledb test suite uses 'mocha', 'should' and 'async'.
 * See LICENSE.md for relevant licenses.
 *
 * NAME
 *   74. lobBindAsStringBuffer.js
 *
 * DESCRIPTION
 *   Testing CLOB/BLOB binding as String/Buffer.
 *
 * NUMBERING RULE
 *   Test numbers follow this numbering rule:
 *     1  - 20  are reserved for basic functional tests
 *     21 - 50  are reserved for data type supporting tests
 *     51 onwards are for other tests
 *
 *****************************************************************************/
'use strict';

var oracledb = require('oracledb');
var should   = require('should');
var async    = require('async');
var dbConfig = require('./dbconfig.js');
var fs = require('fs');

describe('74.lobBindAsStringBuffer.js', function() {
  var connection = null;
  var node6plus = false; // assume node runtime version is lower than 6
  var proc_clob_in_tab = "BEGIN \n" +
                         "    DECLARE \n" +
                         "        e_table_missing EXCEPTION; \n" +
                         "        PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \n" +
                         "    BEGIN \n" +
                         "        EXECUTE IMMEDIATE('DROP TABLE nodb_tab_clob_in'); \n" +
                         "    EXCEPTION \n" +
                         "        WHEN e_table_missing \n" +
                         "        THEN NULL; \n" +
                         "    END; \n" +
                         "    EXECUTE IMMEDIATE (' \n" +
                         "        CREATE TABLE nodb_tab_clob_in ( \n" +
                         "            id      NUMBER, \n" +
                         "            clob_1  CLOB, \n" +
                         "            clob_2  CLOB \n" +
                         "        ) \n" +
                         "    '); \n" +
                         "END; ";

  var proc_blob_in_tab = "BEGIN \n" +
                         "    DECLARE \n" +
                         "        e_table_missing EXCEPTION; \n" +
                         "        PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \n" +
                         "    BEGIN \n" +
                         "        EXECUTE IMMEDIATE('DROP TABLE nodb_tab_blob_in'); \n" +
                         "    EXCEPTION \n" +
                         "        WHEN e_table_missing \n" +
                         "        THEN NULL; \n" +
                         "    END; \n" +
                         "    EXECUTE IMMEDIATE (' \n" +
                         "        CREATE TABLE nodb_tab_blob_in ( \n" +
                         "            id      NUMBER, \n" +
                         "            blob_1  BLOB, \n" +
                         "            blob_2  BLOB \n" +
                         "        ) \n" +
                         "    '); \n" +
                         "END; ";

  var proc_lobs_in_tab = "BEGIN \n" +
                         "    DECLARE \n" +
                         "        e_table_missing EXCEPTION; \n" +
                         "        PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \n" +
                         "    BEGIN \n" +
                         "        EXECUTE IMMEDIATE('DROP TABLE nodb_tab_lobs_in'); \n" +
                         "    EXCEPTION \n" +
                         "        WHEN e_table_missing \n" +
                         "        THEN NULL; \n" +
                         "    END; \n" +
                         "    EXECUTE IMMEDIATE (' \n" +
                         "        CREATE TABLE nodb_tab_lobs_in ( \n" +
                         "            id    NUMBER, \n" +
                         "            clob  CLOB, \n" +
                         "            blob  BLOB \n" +
                         "        ) \n" +
                         "    '); \n" +
                         "END; ";

  before(function(done) {
    oracledb.getConnection(dbConfig, function(err, conn) {
      should.not.exist(err);
      connection = conn;

      // Check whether node runtime version is >= 6 or not
      if ( process.versions["node"].substring (0, 1) >= "6")
        node6plus = true;

      done();
    });
  }); // before

  after(function(done) {
    connection.release(function(err) {
      should.not.exist(err);
      done();
    });
  }); // after

  var setupAllTable = function(callback) {
    async.series([
      function(cb) {
        connection.execute(
          proc_clob_in_tab,
          function(err) {
            should.not.exist(err);
            cb();
          });
      },
      function(cb) {
        connection.execute(
          proc_blob_in_tab,
          function(err) {
            should.not.exist(err);
            cb();
          });
      },
      function(cb) {
        connection.execute(
          proc_lobs_in_tab,
          function(err) {
            should.not.exist(err);
            cb();
          });
      }
    ], callback);
  };

  var dropAllTable = function(callback) {
    async.series([
      function(cb) {
        connection.execute(
          "DROP TABLE nodb_tab_clob_in",
          function(err) {
            should.not.exist(err);
            cb();
          });
      },
      function(cb) {
        connection.execute(
          "DROP TABLE nodb_tab_blob_in",
          function(err) {
            should.not.exist(err);
            cb();
          });
      },
      function(cb) {
        connection.execute(
          "DROP TABLE nodb_tab_lobs_in",
          function(err) {
            should.not.exist(err);
            cb();
          });
      }
    ], callback);
  };

  var executeSQL = function(sql, callback) {
    connection.execute(
      sql,
      function(err) {
        should.not.exist(err);
        return callback();
      }
    );
  };

  var inFileName = './test/clobexample.txt';

  var prepareTableWithClob = function(id, callback) {
    var sql = "INSERT INTO nodb_tab_lobs_in (id, clob) VALUES (:i, EMPTY_CLOB()) RETURNING clob INTO :lobbv";
    var bindVar = { i: id, lobbv: { type: oracledb.CLOB, dir: oracledb.BIND_OUT } };

    connection.execute(
      sql,
      bindVar,
      { autoCommit: false }, // a transaction needs to span the INSERT and pipe()
      function(err, result) {
        should.not.exist(err);
        (result.rowsAffected).should.be.exactly(1);
        (result.outBinds.lobbv.length).should.be.exactly(1);

        var inStream = fs.createReadStream(inFileName);
        var lob = result.outBinds.lobbv[0];

        lob.on('error', function(err) {
          should.not.exist(err, "lob.on 'error' event");
        });

        inStream.on('error', function(err) {
          should.not.exist(err, "inStream.on 'error' event");
        });

        lob.on('close', function() {
          connection.commit( function(err) {
            should.not.exist(err);
            return callback();
          });
        });

        inStream.pipe(lob); // copies the text to the CLOB
      }
    );
  };

  var jpgFileName = './test/fuzzydinosaur.jpg';

  var prepareTableWithBlob = function(id, callback) {
    var sql = "INSERT INTO nodb_tab_lobs_in (id, blob) VALUES (:i, EMPTY_BLOB()) RETURNING blob INTO :lobbv";
    var bindVar = { i: id, lobbv: { type: oracledb.BLOB, dir: oracledb.BIND_OUT } };

    connection.execute(
      sql,
      bindVar,
      { autoCommit: false }, // a transaction needs to span the INSERT and pipe()
      function(err, result) {
        should.not.exist(err);
        (result.rowsAffected).should.be.exactly(1);
        (result.outBinds.lobbv.length).should.be.exactly(1);

        var inStream = fs.createReadStream(jpgFileName);
        var lob = result.outBinds.lobbv[0];

        lob.on('error', function(err) {
          should.not.exist(err, "lob.on 'error' event");
        });

        inStream.on('error', function(err) {
          should.not.exist(err, "inStream.on 'error' event");
        });

        lob.on('close', function() {
          connection.commit( function(err) {
            should.not.exist(err);
            return callback();
          });
        });

        inStream.pipe(lob);
      });
  };

  var verifyClobValueWithFileData = function(selectSql, callback) {
    connection.execute(
      selectSql,
      function(err, result) {
        should.not.exist(err);
        var lob = result.rows[0][0];
        should.exist(lob);
        // set the encoding so we get a 'string' not a 'buffer'
        lob.setEncoding('utf8');
        var clobData = '';

        lob.on('data', function(chunk) {
          clobData += chunk;
        });

        lob.on('error', function(err) {
          should.not.exist(err, "lob.on 'error' event.");
        });

        lob.on('end', function() {
          fs.readFile( inFileName, { encoding: 'utf8' }, function(err, originalData) {
            should.not.exist(err);
            should.strictEqual(clobData, originalData);
            return callback();
          });
        });
      }
    );
  };

  var verifyClobValueWithString = function(selectSql, originalString, callback) {
    connection.execute(
      selectSql,
      function(err, result) {
        should.not.exist(err);
        var lob = result.rows[0][0];

        if (originalString == null | originalString == '' || originalString == undefined) {
          should.not.exist(lob);
          return callback();
        } else {
          should.exist(lob);
          // set the encoding so we get a 'string' not a 'buffer'
          lob.setEncoding('utf8');
          var clobData = '';

          lob.on('data', function(chunk) {
            clobData += chunk;
          });

          lob.on('error', function(err) {
            should.not.exist(err, "lob.on 'error' event.");
          });

          lob.on('end', function() {
            should.strictEqual(clobData, originalString);
            return callback();
          });
        }
      }
    );
  };

  var verifyBlobValueWithFileData = function(selectSql, callback) {
    connection.execute(
      selectSql,
      function(err, result) {
        should.not.exist(err);
        var lob = result.rows[0][0];
        should.exist(lob);

        var blobData = 0;
        var totalLength = 0;
        blobData = node6plus ? Buffer.alloc(0) : new Buffer(0);

        lob.on('data', function(chunk) {
          totalLength = totalLength + chunk.length;
          blobData = Buffer.concat([blobData, chunk], totalLength);
        });

        lob.on('error', function(err) {
          should.not.exist(err, "lob.on 'error' event.");
        });

        lob.on('end', function() {
          fs.readFile( jpgFileName, function(err, originalData) {
            should.not.exist(err);
            should.strictEqual(totalLength, originalData.length);
            originalData.should.eql(blobData);
            return callback();
          });
        });
      });
  };

  var verifyBlobValueWithBuffer = function(selectSql, oraginalBuffer, callback) {
    connection.execute(
      selectSql,
      function(err, result) {
        should.not.exist(err);
        var lob = result.rows[0][0];
        if (oraginalBuffer == null | oraginalBuffer == '' || oraginalBuffer == undefined) {
          should.not.exist(lob);
          return callback();
        } else {
          should.exist(lob);
          var blobData = node6plus ? Buffer.alloc(0) : new Buffer(0);
          var totalLength = 0;

          lob.on('data', function(chunk) {
            totalLength = totalLength + chunk.length;
            blobData = Buffer.concat([blobData, chunk], totalLength);
          });

          lob.on('error', function(err) {
            should.not.exist(err, "lob.on 'error' event.");
          });

          lob.on('end', function() {
            should.strictEqual(totalLength, oraginalBuffer.length);
            oraginalBuffer.should.eql(blobData);
            return callback();
          });
        }
      }
    );
  };

  describe('74.1 CLOB, PLSQL, BIND_IN', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_clobs_in_741 (clob_id IN NUMBER, clob_in IN CLOB)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_clob_in (id, clob_1) values (clob_id, clob_in); \n" +
               "END nodb_clobs_in_741; ";
    var sqlRun = "BEGIN nodb_clobs_in_741 (:i, :c); END;";
    var proc_drop = "DROP PROCEDURE nodb_clobs_in_741";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.1.1 PLSQL, BIND_IN with String length 32768', function(done) {
      // Driver already supports CLOB AS STRING and BLOB AS BUFFER for PLSQL BIND if the data size less than or equal to 32767.
      // As part of this enhancement, driver allows even if data size more than 32767 for both column types
      var len = 32768;
      var sequence = 1;
      var clobStr = 'A'.repeat(len);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: clobStr, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: len }
      };

      async.series([
        function(cb) {
          setupAllTable(cb);
        },
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            });
        },
        function(cb) {
          var sql = "select clob_1 from nodb_tab_clob_in where id = 1";
          verifyClobValueWithString(sql, clobStr, cb);
        }
      ], done);
    });  // 74.1.1

    it('74.1.2 PLSQL, BIND_IN with String length 65535', function(done) {
      // maxSize limits are 64K and 2GB for 11.2 and 12.1 clients, so 64K is tested here as a common case.
      var len = 65535;
      var sequence = 2;
      var clobStr = 'B'.repeat(len);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: clobStr, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: len }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            });
        },
        function(cb) {
          var sql = "select clob_1 from nodb_tab_clob_in where id = 2";
          verifyClobValueWithString(sql, clobStr, cb);
        }
      ], done);
    }); // 74.1.2

    it('74.1.3 PLSQL, BIND_IN with null', function(done) {
      var sequence = 3;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: null, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 50000 }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            });
        },
        function(cb) {
          var sql = "select clob_1 from nodb_tab_clob_in where id = 3";
          verifyClobValueWithString(sql, null, cb);
        }
      ], done);
    }); // 74.1.3

    it('74.1.4 PLSQL, BIND_IN with empty string', function(done) {
      var sequence = 4;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: '', type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 50000 }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            });
        },
        function(cb) {
          var sql = "select clob_1 from nodb_tab_clob_in where id = 4";
          verifyClobValueWithString(sql, null, cb);
        }
      ], done);
    }); // 74.1.4

    it('74.1.5 PLSQL, BIND_IN with undefined', function(done) {
      var sequence = 5;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: undefined, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 50000 }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            });
        },
        function(cb) {
          var sql = "select clob_1 from nodb_tab_clob_in where id = 5";
          verifyClobValueWithString(sql, null, cb);
        }
      ], done);
    }); // 74.1.5

    it('74.1.6 PLSQL, BIND_IN with NaN', function(done) {
      var sequence = 6;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: NaN, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-011: encountered bind value and type mismatch in parameter 2
          (err.message).should.startWith('NJS-011:');
          done();
        }
      );
    }); // 74.1.6

    it('74.1.7 PLSQL, BIND_IN with 0', function(done) {
      var sequence = 6;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: 0, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-011: encountered bind value and type mismatch in parameter 2
          (err.message).should.startWith('NJS-011:');
          done();
        }
      );
    }); // 74.1.7

    it('74.1.8 PLSQL, BIND_IN bind value and type mismatch', function(done) {
      var sequence = 6;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: 20, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-011: encountered bind value and type mismatch in parameter 2
          (err.message).should.startWith('NJS-011:');
          done();
        }
      );
    }); // 74.1.8

    it('74.1.9 PLSQL, BIND_IN mixing named with positional binding', function(done) {
      var sqlRun_7419 = "BEGIN nodb_clobs_in_741 (:1, :2); END;";
      var len = 50000;
      var sequence = 6;
      var clobStr = '8'.repeat(len);
      var bindVar = [ sequence, { val: clobStr, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 50000 } ];

      async.series([
        function(cb) {
          connection.execute(
            sqlRun_7419,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            });
        },
        function(cb) {
          var sql = "select clob_1 from nodb_tab_clob_in where id = 6";
          verifyClobValueWithString(sql, clobStr, cb);
        }
      ], done);
    }); // 74.1.9

    it('74.1.10 PLSQL, BIND_IN with invalid CLOB', function(done) {
      var sequence = 7;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: {}, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: 5000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-012: encountered invalid bind datatype in parameter 2
          (err.message).should.startWith('NJS-012:');
          done();
        }
      );
    }); // 74.1.10

  }); // 74.1

  describe('74.2 CLOB, PLSQL, BIND_OUT', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_clobs_out_742 (clob_id IN NUMBER, clob_out OUT CLOB) \n" +
               "AS \n" +
               "BEGIN \n" +
                "    select clob_1 into clob_out from nodb_tab_clob_in where id = clob_id; \n" +
               "END nodb_clobs_out_742; ";
    var sqlRun = "BEGIN nodb_clobs_out_742 (:i, :c); END;";
    var proc_drop = "DROP PROCEDURE nodb_clobs_out_742";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it.skip('74.2.1 PLSQL, BIND_OUT with String length 32768', function(done) {
      // Driver already supports CLOB AS STRING and BLOB AS BUFFER for PLSQL BIND if the data size less than or equal to 32767.
      // As part of this enhancement, driver allows even if data size more than 32767 for both column types
      var len = 32768;
      var sequence = 1;
      var clobStr = 'A'.repeat(len);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: len }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          // console.log(result.outBinds.c);
          // should.strictEqual(result.outBinds.c, clobStr);
          result.outBinds.c.should.eql(clobStr);
          should.strictEqual(result.outBinds.c.length, len);
          done();
        }
      );
    });  // 74.2.1

    it.skip('74.2.2 PLSQL, BIND_OUT with String length 65535', function(done) {
      // maxSize limits are 64K and 2GB for 11.2 and 12.1 clients, so 64K is tested here as a common case.
      var len = 65535;
      var sequence = 2;
      var clobStr = 'B'.repeat(len);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: len }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c, clobStr);
          should.strictEqual(result.outBinds.c.length, len);
          done();
        }
      );
    });  // 74.2.2

    it('74.2.3 PLSQL, BIND_OUT with null', function(done) {
      var sequence = 3;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c, null);
          done();
        }
      );
    });  // 74.2.3

    it('74.2.4 PLSQL, BIND_OUT with empty string', function(done) {
      var sequence = 4;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c, null);
          done();
        }
      );
    });  // 74.2.4

    it('74.2.5 PLSQL, BIND_OUT with undefined', function(done) {
      var sequence = 5;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c, null);
          done();
        }
      );
    });  // 74.2.5

    it.skip('74.2.6 PLSQL, BIND_OUT mixing named with positional binding', function(done) {
      var len = 50000;
      var sequence = 6;
      var clobStr = '8'.repeat(len);
      var bindVar = [ sequence, { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: len } ];

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds[0], clobStr);
          should.strictEqual(result.outBinds[0].length, len);
          done();
        }
      );
    });  // 74.2.6

    it.skip('74.2.7 PLSQL, BIND_OUT with limited maxSize', function(done) {
      var sequence = 2;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err) {
          should.exist(err);
          // NJS-016: buffer is too small for OUT binds
          (err.message).should.startWith('NJS-016:');
          done();
        }
      );
    });  // 74.2.7

  }); // 74.2

  describe('74.3 CLOB, PLSQL, BIND_INOUT', function() {
    var clob_proc_inout = "CREATE OR REPLACE PROCEDURE nodb_clob_in_out_743 (lob_in_out IN OUT CLOB) \n" +
                          "AS \n" +
                          "BEGIN \n" +
                          "    lob_in_out := lob_in_out; \n" +
                          "END nodb_clob_in_out_743;";
    var sqlRun = "begin nodb_clob_in_out_743(lob_in_out => :lob_in_out); end;";
    var proc_drop = "DROP PROCEDURE nodb_clob_in_out_743";

    before(function(done) {
      executeSQL(clob_proc_inout, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.3.1 PLSQL, BIND_INOUT', function(done) {
      var clobVal = 'A'.repeat(32768);
      var bindVar = {
        lob_in_out: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, val: clobVal }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err) {
          should.exist(err);
          // ORA-01460: unimplemented or unreasonable conversion requested
          (err.message).should.startWith('ORA-01460:');
          done();
        }
      );
    }); // 74.3.1

  }); // 74.3

  describe('74.4 BLOB, PLSQL, BIND_IN', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_744 (blob_id IN NUMBER, blob_in IN BLOB)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_blob_in (id, blob_1) values (blob_id, blob_in); \n" +
               "END nodb_blobs_in_744; ";
    var sqlRun = "BEGIN nodb_blobs_in_744 (:i, :b); END;";
    var proc_drop = "DROP PROCEDURE nodb_blobs_in_744";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.4.1 PLSQL, BIND_IN with Buffer size 32768', function(done) {
      // Driver already supports CLOB AS STRING and BLOB AS BUFFER for PLSQL BIND if the data size less than or equal to 32767.
      // As part of this enhancement, driver allows even if data size more than 32767 for both column types
      var size = 32768;
      var sequence = 1;
      var bigStr = 'A'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
          verifyBlobValueWithBuffer(sql, bufferStr, cb);
        }
      ], done);
    }); // 74.4.1

    it('74.4.2 PLSQL, BIND_IN with Buffer size 65535', function(done) {
      // maxSize limits are 64K and 2GB for 11.2 and 12.1 clients, so 64K is tested here as a common case.
      var size = 65535;
      var sequence = 2;
      var bigStr = 'B'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
          verifyBlobValueWithBuffer(sql, bufferStr, cb);
        }
      ], done);
    }); // 74.4.2

    it('74.4.3 PLSQL, BIND_IN with null', function(done) {
      var sequence = 3;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: null, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
          verifyBlobValueWithBuffer(sql, null, cb);
        }
      ], done);
    }); // 74.4.3

    it('74.4.4 PLSQL, BIND_IN with empty string', function(done) {
      var sequence = 4;
      var bufferStr = node6plus ? new Buffer('') : Buffer.from('');
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
          verifyBlobValueWithBuffer(sql, null, cb);
        }
      ], done);
    }); // 74.4.4

    it('74.4.5 PLSQL, BIND_IN with undefined', function(done) {
      var sequence = 5;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: undefined, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
          verifyBlobValueWithBuffer(sql, null, cb);
        }
      ], done);
    }); // 74.4.5

    it('74.4.6 PLSQL, BIND_IN with NaN', function(done) {
      var sequence = 6;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: NaN, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-011: encountered bind value and type mismatch in parameter 2
          (err.message).should.startWith('NJS-011:');
          done();
        }
      );
    }); // 74.4.6

    it('74.4.7 PLSQL, BIND_IN with 0', function(done) {
      var sequence = 6;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: 0, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-011: encountered bind value and type mismatch in parameter 2
          (err.message).should.startWith('NJS-011:');
          done();
        }
      );
    }); // 74.4.7

    it('74.4.8 PLSQL, BIND_IN bind value and type mismatch', function(done) {
      var sequence = 6;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: 200, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-011: encountered bind value and type mismatch in parameter 2
          (err.message).should.startWith('NJS-011:');
          done();
        }
      );
    }); // 74.4.8

    it('74.4.9 PLSQL, BIND_IN mixing named with positional binding', function(done) {
      var size = 50000;
      var sequence = 6;
      var bigStr = '8'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = [ sequence, { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size } ];

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
          verifyBlobValueWithBuffer(sql, bufferStr, cb);
        }
      ], done);
    }); // 74.4.9

    it('74.4.10 PLSQL, BIND_IN without maxSize', function(done) {
      var size = 65535;
      var sequence = 7;
      var bigStr = '9'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: bufferStr, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql = "select blob_1 from nodb_tab_blob_in where id = " + sequence;
          verifyBlobValueWithBuffer(sql, bufferStr, cb);
        }
      ], done);
    }); // 74.4.10

    it('74.4.11 PLSQL, BIND_IN with invalid BLOB', function(done) {
      var sequence = 7;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { val: {}, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
      };

      connection.execute(
        sqlRun,
        bindVar,
        { autoCommit: true },
        function(err) {
          should.exist(err);
          // NJS-012: encountered invalid bind datatype in parameter 2
          (err.message).should.startWith('NJS-012:');
          done();
        }
      );
    }); // 74.4.11

  }); // 74.4

  describe('74.5 BLOB, PLSQL, BIND_OUT', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_blobs_out_745 (blob_id IN NUMBER, blob_out OUT BLOB) \n" +
               "AS \n" +
               "BEGIN \n" +
               "    select blob_1 into blob_out from nodb_tab_blob_in where id = blob_id; \n" +
               "END nodb_blobs_out_745; ";
    var sqlRun = "BEGIN nodb_blobs_out_745 (:i, :b); END;";
    var proc_drop = "DROP PROCEDURE nodb_blobs_out_745";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.5.1 PLSQL, BIND_OUT with Buffer size 32768', function(done) {
      // Driver already supports CLOB AS STRING and BLOB AS BUFFER for PLSQL BIND if the data size less than or equal to 32767.
      // As part of this enhancement, driver allows even if data size more than 32767 for both column types
      var size = 32768;
      var sequence = 1;
      var bigStr = 'A'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: size }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          (result.outBinds.b).should.eql(bufferStr);
          should.strictEqual(result.outBinds.b.length, size);
          done();
        }
      );
    }); // 74.5.1

    it('74.5.2 PLSQL, BIND_OUT with Buffer size 65535', function(done) {
      // maxSize limits are 64K and 2GB for 11.2 and 12.1 clients, so 64K is tested here as a common case.
      var size = 65535;
      var sequence = 2;
      var bigStr = 'B'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: size }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          (result.outBinds.b).should.eql(bufferStr);
          should.strictEqual(result.outBinds.b.length, size);
          done();
        }
      );
    }); // 74.5.2

    it('74.5.3 PLSQL, BIND_OUT with null', function(done) {
      var sequence = 3;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.b, null);
          done();
        }
      );
    }); // 74.5.3

    it('74.5.4 PLSQL, BIND_OUT with empty string', function(done) {
      var sequence = 4;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.b, null);
          done();
        }
      );
    }); // 74.5.4

    it('74.5.5 PLSQL, BIND_OUT with undefined', function(done) {
      var sequence = 5;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.b, null);
          done();
        }
      );
    }); // 74.5.5

    it('74.5.6 PLSQL, BIND_OUT mixing named with positional binding', function(done) {
      var size = 50000;
      var sequence = 6;
      var bigStr = '8'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = [ sequence, { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: size } ];

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          (result.outBinds[0]).should.eql(bufferStr);
          should.strictEqual(result.outBinds[0].length, size);
          done();
        }
      );
    }); // 74.5.6

    it('74.5.7 PLSQL, BIND_OUT with limited maxSize', function(done) {
      var sequence = 2;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: 50000 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err) {
          should.exist(err);
          // NJS-016: buffer is too small for OUT binds
          (err.message).should.startWith('NJS-016:');
          done();
        }
      );
    }); // 74.5.7

    it('74.5.8 PLSQL, BIND_OUT without maxSize', function(done) {
      var sequence = 7;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err) {
          should.exist(err);
          // ORA-06502: PL/SQL: numeric or value error
          (err.message).should.startWith('ORA-06502:');
          done();
        }
      );
    }); // 74.5.8

  }); // 74.5

  describe('74.6 BLOB, PLSQL, BIND_INOUT', function() {
    var blob_proc_inout = "CREATE OR REPLACE PROCEDURE nodb_blob_in_out_746 (lob_in_out IN OUT BLOB) \n" +
                          "AS \n" +
                          "BEGIN \n" +
                          "    lob_in_out := lob_in_out; \n" +
                          "END nodb_blob_in_out_746;";
    var sqlRun = "begin nodb_blob_in_out_746(lob_in_out => :lob_in_out); end;";
    var proc_drop = "DROP PROCEDURE nodb_blob_in_out_746";

    before(function(done) {
      executeSQL(blob_proc_inout, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.6.1 PLSQL, BIND_INOUT', function(done) {
      var size = 32768;
      var bigStr = '8'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = {
        lob_in_out: { dir: oracledb.BIND_INOUT, type: oracledb.BUFFER, val: bufferStr }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err) {
          should.exist(err);
          (err.message).should.startWith('ORA-01460:');
          done();
        }
      );
    });
  });

  describe('74.7 Multiple CLOBs, BIND_IN', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_lobs_in_747 (clob_id IN NUMBER, clob_1 IN CLOB, clob_2 IN CLOB)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_clob_in (id, clob_1, clob_2) values (clob_id, clob_1, clob_2); \n" +
               "END nodb_lobs_in_747; ";
    var sqlRun = "BEGIN nodb_lobs_in_747 (:i, :c1, :c2); END;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_in_747";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.7.1 PLSQL, BIND_IN, bind two string', function(done) {
      var sequence = 100;
      var len1 = 50000;
      var clobStr_1 = 'A'.repeat(len1);
      var len2 = 10000;
      var clobStr_2 = 'b'.repeat(len2);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c1: { val: clobStr_1, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: len1 },
        c2: { val: clobStr_2, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: len2 }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql_1 = "select clob_1 from nodb_tab_clob_in where id = 100";
          verifyClobValueWithString(sql_1, clobStr_1, cb);
        },
        function(cb) {
          var sql_2 = "select clob_2 from nodb_tab_clob_in where id = 100";
          verifyClobValueWithString(sql_2, clobStr_2, cb);
        }
      ], done);
    }); // 74.7.1

    it('74.7.2 PLSQL, BIND_IN, bind a txt file and a string', function(done) {
      var preparedCLOBID = 200;
      var len1 = 50000;
      var clobStr_1 = 'A'.repeat(len1);

      async.series([
        function(cb) {
          prepareTableWithClob(preparedCLOBID, cb);
        },
        function(cb) {
          connection.execute(
            "select clob from nodb_tab_lobs_in where id = :id",
            { id: preparedCLOBID },
            function(err, result) {
              should.not.exist(err);
              (result.rows.length).should.not.eql(0);

              var clob = result.rows[0][0];
              var sequence = 101;
              connection.execute(
                sqlRun,
                {
                  i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
                  c1: { val: clobStr_1, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: len1 },
                  c2: { val: clob, type: oracledb.CLOB, dir: oracledb.BIND_IN }
                },
                { autoCommit: true },
                function(err) {
                  should.not.exist(err);
                  cb();
                }
              );
            }
          );
        },
        function(cb) {
          var sql_1 = "select clob_1 from nodb_tab_clob_in where id = 101";
          verifyClobValueWithString(sql_1, clobStr_1, cb);
        },
        function(cb) {
          var sql_2 = "select clob_2 from nodb_tab_clob_in where id = 101";
          verifyClobValueWithFileData(sql_2, cb);
        }
      ], done);
    }); // 74.7.2

  }); // 74.7

  describe('74.8 Multiple CLOBs, BIND_OUT', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_lobs_out_748 (clob_id IN NUMBER, clob_1 OUT CLOB, clob_2 OUT CLOB) \n" +
               "AS \n" +
               "BEGIN \n" +
               "    select clob_1, clob_2 into clob_1, clob_2 from nodb_tab_clob_in where id = clob_id; \n" +
               "END nodb_lobs_out_748; ";
    var sqlRun = "BEGIN nodb_lobs_out_748 (:i, :c1, :c2); END;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_out_748";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it.skip('74.8.1 PLSQL, BIND_OUT, bind two string', function(done) {
      var sequence = 100;
      var len1 = 50000;
      var clobStr_1 = 'A'.repeat(len1);
      var len2 = 10000;
      var clobStr_2 = 'b'.repeat(len2);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c1: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: len1 },
        c2: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: len2 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c1, clobStr_1);
          should.strictEqual(result.outBinds.c1.length, len1);
          should.strictEqual(result.outBinds.c2, clobStr_2);
          should.strictEqual(result.outBinds.c2.length, len2);
          done();
        }
      );
    });  // 74.8.1

    it.skip('74.8.2 PLSQL, BIND_OUT, bind a txt file and a string', function(done) {
      var sequence = 101;
      var len1 = 50000;
      var clobStr_1 = 'A'.repeat(len1);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c1: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: len1 },
        c2: { type: oracledb.CLOB, dir: oracledb.BIND_OUT }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c1, clobStr_1);
          should.strictEqual(result.outBinds.c1.length, len1);
          var lob = result.outBinds.c2;
          should.exist(lob);
          lob.setEncoding("utf8");
          var clobData = '';
          lob.on('data', function(chunk) {
            clobData += chunk;
          });

          lob.on('error', function(err) {
            should.not.exist(err, "lob.on 'error' event.");
          });

          lob.on('end', function() {
            fs.readFile( inFileName, { encoding: 'utf8' }, function(err, originalData) {
              should.not.exist(err);
              should.strictEqual(clobData, originalData);
            });
          });
          done();
        }
      );
    });  // 74.8.2

  }); // 74.8

  describe('74.9 Multiple CLOBs, BIND INOUT', function() {
    var lobs_proc_inout = "CREATE OR REPLACE PROCEDURE nodb_lobs_in_out_749 (clob_1 IN OUT CLOB, clob_2 IN OUT CLOB) \n" +
                          "AS \n" +
                          "BEGIN \n" +
                          "    clob_1 := clob_1; \n" +
                          "    clob_2 := clob_2; \n" +
                          "END nodb_lobs_in_out_749;";
    var sqlRun = "begin nodb_lobs_in_out_749(:lob_1, :lob_2); end;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_in_out_749";

    before(function(done) {
      executeSQL(lobs_proc_inout, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.9.1 PLSQL, BIND_INOUT, bind a txt file and a string', function(done) {
      var len1 = 32768;
      var clobVal = 'A'.repeat(len1);
      var preparedCLOBID = 200;

      async.series([
        function(cb) {
          prepareTableWithClob(preparedCLOBID, cb);
        },
        function(cb) {
          connection.execute(
            "select clob from nodb_tab_lobs_in where id = :id",
            { id: preparedCLOBID },
            function(err, result) {
              should.not.exist(err);
              (result.rows.length).should.not.eql(0);
              var clob = result.rows[0][0];
              connection.execute(
                sqlRun,
                {
                  lob_1: { val: clobVal, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: len1 },
                  lob_2: { val: clob, type: oracledb.CLOB, dir: oracledb.BIND_INOUT }
                },
                { autoCommit: true },
                function(err) {
                  should.exist(err);
                  // ORA-01460: unimplemented or unreasonable conversion requested
                  (err.message).should.startWith('ORA-01460:');
                  cb();
                }
              );
            }
          );
        }
      ], done);
    }); // 74.9.1

  }); // 74.9

  describe('74.10 Multiple BLOBs, BIND_IN', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_blobs_in_7410 (blob_id IN NUMBER, blob_1 IN BLOB, blob_2 IN BLOB)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_blob_in (id, blob_1, blob_2) values (blob_id, blob_1, blob_2); \n" +
               "END nodb_blobs_in_7410; ";
    var sqlRun = "BEGIN nodb_blobs_in_7410 (:i, :b1, :b2); END;";
    var proc_drop = "DROP PROCEDURE nodb_blobs_in_7410";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.10.1 PLSQL, BIND_IN, bind two Buffer', function(done) {
      var size_1 = 32768;
      var size_2 = 50000;
      var bigStr_1 = 'A'.repeat(size_1);
      var bigStr_2 = '8'.repeat(size_2);
      var bufferStr_1 = node6plus ? new Buffer(bigStr_1) : Buffer.from(bigStr_1);
      var bufferStr_2 = node6plus ? new Buffer(bigStr_2) : Buffer.from(bigStr_2);
      var sequence = 100;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_1 },
        b2: { val: bufferStr_2, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_2 }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql_1 = "select blob_1 from nodb_tab_blob_in where id = 100";
          verifyBlobValueWithBuffer(sql_1, bufferStr_1, cb);
        },
        function(cb) {
          var sql_2 = "select blob_2 from nodb_tab_blob_in where id = 100";
          verifyBlobValueWithBuffer(sql_2, bufferStr_2, cb);
        }
      ], done);
    }); // 74.10.1

    it('74.10.2 PLSQL, BIND_IN, bind a JPG file and a Buffer', function(done) {
      var preparedCLOBID = 201;
      var size_1 = 32768;
      var bigStr_1 = 'A'.repeat(size_1);
      var bufferStr_1 = node6plus ? new Buffer(bigStr_1) : Buffer.from(bigStr_1);

      async.series([
        function(cb) {
          prepareTableWithBlob(preparedCLOBID, cb);
        },
        function(cb) {
          connection.execute(
            "select blob from nodb_tab_lobs_in where id = :id",
            { id: preparedCLOBID },
            function(err, result) {
              should.not.exist(err);
              (result.rows.length).should.not.eql(0);
              var blob = result.rows[0][0];
              var sequence = 101;

              connection.execute(
                sqlRun,
                {
                  i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
                  b1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: size_1 },
                  b2: { val: blob, type: oracledb.BLOB, dir: oracledb.BIND_IN }
                },
                { autoCommit: true },
                function(err) {
                  should.not.exist(err);
                  cb();
                }
              );
            }
          );
        },
        function(cb) {
          var sql_1 = "select blob_1 from nodb_tab_blob_in where id = 101";
          verifyBlobValueWithBuffer(sql_1, bufferStr_1, cb);
        },
        function(cb) {
          var sql_2 = "select blob_2 from nodb_tab_blob_in where id = 101";
          verifyBlobValueWithFileData(sql_2, cb);
        }
      ], done);
    }); // 74.10.2

  }); // 74.10

  describe('74.11 Multiple BLOBs, BIND_OUT', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_lobs_out_7411 (blob_id IN NUMBER, blob_1 OUT BLOB, blob_2 OUT BLOB) \n" +
               "AS \n" +
               "BEGIN \n" +
               "    select blob_1, blob_2 into blob_1, blob_2 from nodb_tab_blob_in where id = blob_id; \n" +
               "END nodb_lobs_out_7411; ";
    var sqlRun = "BEGIN nodb_lobs_out_7411 (:i, :b1, :b2); END;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_out_7411";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.11.1 PLSQL, BIND_OUT, bind two buffer', function(done) {
      var size_1 = 32768;
      var size_2 = 50000;
      var bigStr_1 = 'A'.repeat(size_1);
      var bigStr_2 = '8'.repeat(size_2);
      var bufferStr_1 = node6plus ? new Buffer(bigStr_1) : Buffer.from(bigStr_1);
      var bufferStr_2 = node6plus ? new Buffer(bigStr_2) : Buffer.from(bigStr_2);
      var sequence = 100;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b1: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: size_1 },
        b2: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: size_2 }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          (result.outBinds.b1).should.eql(bufferStr_1);
          should.strictEqual(result.outBinds.b1.length, size_1);
          (result.outBinds.b2).should.eql(bufferStr_2);
          should.strictEqual(result.outBinds.b2.length, size_2);
          done();
        }
      );
    }); // 74.11.1

    it('74.11.2 PLSQL, BIND_OUT, bind a JPG file and a Buffer', function(done) {
      var sequence = 101;
      var size_1 = 32768;
      var bigStr_1 = 'A'.repeat(size_1);
      var bufferStr_1 = node6plus ? new Buffer(bigStr_1) : Buffer.from(bigStr_1);
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        b1: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: size_1 },
        b2: { type: oracledb.BLOB, dir: oracledb.BIND_OUT }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          (result.outBinds.b1).should.eql(bufferStr_1);
          // console.log(result.outBinds);
          should.strictEqual(result.outBinds.b1.length, size_1);
          var lob = result.outBinds.b2;
          var blobData = node6plus ? Buffer.alloc(0) : new Buffer(0);
          var totalLength = 0;

          lob.on('data', function(chunk) {
            totalLength = totalLength + chunk.length;
            blobData = Buffer.concat([blobData, chunk], totalLength);
          });

          lob.on('error', function(err) {
            should.not.exist(err, "lob.on 'error' event.");
          });

          lob.on('end', function() {
            fs.readFile( jpgFileName, function(err, originalData) {
              should.not.exist(err);
              should.strictEqual(totalLength, originalData.length);
              originalData.should.eql(blobData);
              done();
            });
          });
        }
      );
    }); // 74.11.2

  }); // 74.11

  describe('74.12 Multiple BLOBs, BIND_INOUT', function() {
    var lobs_proc_inout = "CREATE OR REPLACE PROCEDURE nodb_lobs_in_out_7412 (blob_1 IN OUT BLOB, blob_2 IN OUT BLOB) \n" +
                          "AS \n" +
                          "BEGIN \n" +
                          "    blob_1 := blob_1; \n" +
                          "    blob_2 := blob_2; \n" +
                          "END nodb_lobs_in_out_7412;";
    var sqlRun = "begin nodb_lobs_in_out_7412(:lob_1, :lob_2); end;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_in_out_7412";

    before(function(done) {
      executeSQL(lobs_proc_inout, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.12.1 PLSQL, BIND_INOUT, bind a JPG and a buffer', function(done) {
      var preparedCLOBID = 200;
      var size_1 = 32768;
      var bigStr_1 = 'A'.repeat(size_1);
      var bufferStr_1 = node6plus ? new Buffer(bigStr_1) : Buffer.from(bigStr_1);

      async.series([
        function(cb) {
          prepareTableWithBlob(preparedCLOBID, cb);
        },
        function(cb) {
          connection.execute(
            "select blob from nodb_tab_lobs_in where id = :id",
            { id: preparedCLOBID },
            function(err, result) {
              should.not.exist(err);
              (result.rows.length).should.not.eql(0);
              var blob = result.rows[0][0];
              connection.execute(
                sqlRun,
                {
                  lob_1: { val: bufferStr_1, type: oracledb.BUFFER, dir: oracledb.BIND_INOUT, maxSize: size_1 },
                  lob_2: { val: blob, type: oracledb.BLOB, dir: oracledb.BIND_INOUT }
                },
                { autoCommit: true },
                function(err) {
                  should.exist(err);
                  // ORA-01460: unimplemented or unreasonable conversion requested
                  (err.message).should.startWith('ORA-01460:');
                  cb();
                }
              );
            }
          );
        }
      ], done);
    });
  }); // 74.12

  describe('74.13 Multiple LOBs, BIND_IN', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_lobs_in_7413 (id IN NUMBER, clob_in IN CLOB, blob_in IN BLOB)\n" +
               "AS \n" +
               "BEGIN \n" +
               "    insert into nodb_tab_lobs_in (id, clob, blob) values (id, clob_in, blob_in); \n" +
               "END nodb_lobs_in_7413; ";
    var sqlRun = "BEGIN nodb_lobs_in_7413 (:i, :c, :b); END;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_in_7413";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.13.1 PLSQL, CLOB&BLOB, bind a string and a buffer', function(done) {
      var length = 50000;
      var bigStr = 'A'.repeat(length);
      var bigBuffer = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var sequence = 1;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: bigStr, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: length },
        b: { val: bigBuffer, type: oracledb.BUFFER, dir: oracledb.BIND_IN, maxSize: length }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            { autoCommit: true },
            function(err) {
              should.not.exist(err);
              cb();
            }
          );
        },
        function(cb) {
          var sql_1 = "select clob from nodb_tab_lobs_in where id = 1";
          verifyClobValueWithString(sql_1, bigStr, cb);
        },
        function(cb) {
          var sql_2 = "select blob from nodb_tab_lobs_in where id = 1";
          verifyBlobValueWithBuffer(sql_2, bigBuffer, cb);
        }
      ], done);
    }); // 74.13.1

    it('74.13.2 PLSQL, CLOB&BLOB, bind a string and a JPG file', function(done) {
      var preparedCLOBID = 202;
      var size = 40000;
      var bigStr = 'A'.repeat(size);

      async.series([
        function(cb) {
          prepareTableWithBlob(preparedCLOBID, cb);
        },
        function(cb) {
          connection.execute(
            "select blob from nodb_tab_lobs_in where id = :id",
            { id: preparedCLOBID },
            function(err, result) {
              should.not.exist(err);
              (result.rows.length).should.not.eql(0);
              var blob = result.rows[0][0];
              var sequence = 2;

              connection.execute(
                sqlRun,
                {
                  i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
                  c: { val: bigStr, type: oracledb.STRING, dir: oracledb.BIND_IN, maxSize: size },
                  b: { val: blob, type: oracledb.BLOB, dir: oracledb.BIND_IN }
                },
                { autoCommit: true },
                function(err) {
                  should.not.exist(err);
                  cb();
                });
            });
        },
        function(cb) {
          var sql_1 = "select clob from nodb_tab_lobs_in where id = 2";
          verifyClobValueWithString(sql_1, bigStr, cb);
        },
        function(cb) {
          var sql_2 = "select blob from nodb_tab_lobs_in where id = 2";
          verifyBlobValueWithFileData(sql_2, cb);
        }
      ], done);
    }); // 74.13.2

    it('74.13.3 PLSQL, CLOB&BLOB, bind a txt file and a Buffer', function(done) {
      var preparedCLOBID = 200;
      var size = 40000;
      var bigStr = 'A'.repeat(size);
      var bigBuffer = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);

      async.series([
        function(cb) {
          prepareTableWithClob(preparedCLOBID, cb);
        },
        function(cb) {
          connection.execute(
            "select clob from nodb_tab_lobs_in where id = :id",
            { id: preparedCLOBID },
            function(err, result) {
              should.not.exist(err);
              (result.rows.length).should.not.eql(0);
              var clob = result.rows[0][0];
              var sequence = 3;

              connection.execute(
                sqlRun,
                {
                  i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
                  c: { val: clob, type: oracledb.CLOB, dir: oracledb.BIND_IN },
                  b: { val: bigBuffer, type: oracledb.BUFFER, dir: oracledb.BIND_IN }
                },
                { autoCommit: true },
                function(err) {
                  should.not.exist(err);
                  cb();
                }
              );
            }
          );
        },
        function(cb) {
          var sql_1 = "select clob from nodb_tab_lobs_in where id = 3";
          verifyClobValueWithFileData(sql_1, cb);
        },
        function(cb) {
          var sql_2 = "select blob from nodb_tab_lobs_in where id = 3";
          verifyBlobValueWithBuffer(sql_2, bigBuffer, cb);
        }
      ], done);
    }); // 74.13.3

  }); // 74.13

  describe('74.14 Multiple LOBs, BIND_OUT', function() {
    var proc = "CREATE OR REPLACE PROCEDURE nodb_lobs_out_7414 (lob_id IN NUMBER, clob OUT CLOB, blob OUT BLOB) \n" +
               "AS \n" +
               "BEGIN \n" +
               "    select clob, blob into clob, blob from nodb_tab_lobs_in where id = lob_id; \n" +
               "END nodb_lobs_out_7414; ";
    var sqlRun = "BEGIN nodb_lobs_out_7414 (:i, :c, :b); END;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_out_7414";

    before(function(done) {
      executeSQL(proc, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it.skip('74.14.1 PLSQL, CLOB&BLOB, bind a string and a buffer', function(done) {
      var length = 50000;
      var bigStr = 'A'.repeat(length);
      var bigBuffer = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var sequence = 1;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: length },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: length }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c, bigStr);
          should.strictEqual(result.outBinds.c.length, length);
          (result.outBinds.b).should.eql(bigBuffer);
          should.strictEqual(result.outBinds.b.length, length);
          done();
        });
    }); // 74.14.1

    it.skip('74.14.2 PLSQL, CLOB&BLOB, bind a string and a JPG file', function(done) {
      var size = 40000;
      var bigStr = 'A'.repeat(size);
      var sequence = 2;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.STRING, dir: oracledb.BIND_OUT, maxSize: size },
        b: { type: oracledb.BLOB, dir: oracledb.BIND_OUT }
      };

      connection.execute(
        sqlRun,
        bindVar,
        function(err, result) {
          should.not.exist(err);
          should.strictEqual(result.outBinds.c, bigStr);
          should.strictEqual(result.outBinds.c.length, size);
          var lob = result.outBinds.b;
          var blobData = node6plus ? Buffer.alloc(0) : new Buffer(0);
          var totalLength = 0;

          lob.on('data', function(chunk) {
            totalLength = totalLength + chunk.length;
            blobData = Buffer.concat([blobData, chunk], totalLength);
          });

          lob.on('error', function(err) {
            should.not.exist(err, "lob.on 'error' event.");
          });

          lob.on('end', function() {
            fs.readFile( jpgFileName, function(err, originalData) {
              should.not.exist(err);
              should.strictEqual(totalLength, originalData.length);
              originalData.should.eql(blobData);
              done();
            });
          });
        }
      );
    }); // 74.14.2

    it('74.14.3 PLSQL, CLOB&BLOB, bind a txt file and a buffer', function(done) {
      var size = 40000;
      var bigStr = 'A'.repeat(size);
      var bigBuffer = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var sequence = 3;
      var bindVar = {
        i: { val: sequence, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { type: oracledb.CLOB, dir: oracledb.BIND_OUT },
        b: { type: oracledb.BUFFER, dir: oracledb.BIND_OUT, maxSize: size }
      };

      async.series([
        function(cb) {
          connection.execute(
              sqlRun,
              bindVar,
              function(err, result) {
                should.not.exist(err);
                (result.outBinds.b).should.eql(bigBuffer);
                should.strictEqual(result.outBinds.b.length, size);
                var lob = result.outBinds.c;
                should.exist(lob);
                lob.setEncoding("utf8");
                var clobData = '';
                lob.on('data', function(chunk) {
                  clobData += chunk;
                });

                lob.on('error', function(err) {
                  should.not.exist(err, "lob.on 'error' event.");
                });

                lob.on('end', function() {
                  fs.readFile( inFileName, { encoding: 'utf8' }, function(err, originalData) {
                    should.not.exist(err);
                    should.strictEqual(clobData, originalData);
                    cb();
                  });
                });
              });
        }
      ], done);
    }); // 74.14.3

  }); // 74.14

  describe('74.15 Multiple LOBs, BIND_INOUT', function() {
    var lobs_proc_inout = "CREATE OR REPLACE PROCEDURE nodb_lobs_in_out_7415 (clob IN OUT CLOB, blob IN OUT BLOB) \n" +
                          "AS \n" +
                          "BEGIN \n" +
                          "    clob := clob; \n" +
                          "    blob := blob; \n" +
                          "END nodb_lobs_in_out_7415;";
    var sqlRun = "begin nodb_lobs_in_out_7415(:clob, :blob); end;";
    var proc_drop = "DROP PROCEDURE nodb_lobs_in_out_7415";

    before(function(done) {
      executeSQL(lobs_proc_inout, done);
    }); // before

    after(function(done) {
      executeSQL(proc_drop, done);
    }); // after

    it('74.15.1 PLSQL, BIND_INOUT, bind a string and a buffer', function(done) {
      var size = 32768;
      var bigStr = 'A'.repeat(size);
      var bufferStr = node6plus ? new Buffer(bigStr) : Buffer.from(bigStr);
      var bindVar = {
        clob: { dir: oracledb.BIND_INOUT, type: oracledb.STRING, val: bigStr },
        blob: { dir: oracledb.BIND_INOUT, type: oracledb.BUFFER, val: bufferStr }
      };

      async.series([
        function(cb) {
          connection.execute(
            sqlRun,
            bindVar,
            function(err) {
              should.exist(err);
              // ORA-01460: unimplemented or unreasonable conversion requested
              (err.message).should.startWith('ORA-01460:');
              cb();
            }
          );
        },
        function(cb) {
          dropAllTable(cb);
        }
      ], done);
    }); // 74.15.1

  }); // 74.15

});