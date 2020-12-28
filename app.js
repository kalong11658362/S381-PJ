const express = require('express');

const http = require('http');
const url = require('url');

const session = require('cookie-session');
const bodyParser = require('body-parser');

const app = express();
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const fs = require('fs');
const formidable = require('express-formidable');
const mongourl = '';
const dbName = 'PJ1';

var currentUser = '';

app.set('view engine', 'ejs');

const SECRETKEY = 'secretkey';

const users = new Array(
	{name: 'demo', password: ''},
	{name: 'student', password: ''}
)

app.use(session({
  name: 'loginSession',
  keys: [SECRETKEY]
}));;

// support parsing of application/json type post data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req,res) => {
	console.log(req.session);
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
		res.redirect('/find');
	}
});

app.get('/login', (req,res) => {
	res.status(200).render('login',{});
});

app.post('/login', (req,res) => {
	users.forEach((user) => {
	
		if (user.name == req.body.name && user.password == req.body.password) {
			
			req.session.authenticated = true;        
			req.session.username = req.body.name;	 
			console.log("Login Success");
			currentUser = req.body.name;
			res.redirect('/find');			
		}
	});
	res.end();
});

app.get('/logout', (req,res) => {
	req.session = null;   
	res.redirect('/login');
});

app.use(formidable());

const findDocument = (db, criteria, callback) => {
    let cursor = db.collection('restaurants').find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err,docs) => {
        assert.equal(err,null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

const handle_Find = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        findDocument(db, criteria, (docs) => {
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('list',{nRestaurants: docs.length, restaurants: docs, message: currentUser});
        });
    });
}

const handle_Details = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        findDocument(db, DOCID, (docs) => { 
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('details', {restaurant: docs[0]});
        });
    });
}

const handle_Edit = (res, criteria) => {

    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        let cursor = db.collection('restaurants').find(DOCID);
        cursor.toArray((err,docs) => {
            client.close();
            assert.equal(err,null);
            res.status(200).render('edit',{restaurant: docs[0]});
        });
    });
}

const updateDocument = (criteria, updateDoc, callback) => {

    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

         db.collection('restaurants').updateOne(criteria,
            {
                $set : updateDoc
            },
            (err, results) => {
                client.close();
                assert.equal(err, null);
                callback(results);
            }
        );
    });
}

const handle_Update = (req, res, criteria) => {

	
	
        var DOCID = {};
        DOCID['_id'] = ObjectID(req.fields._id);
        var updateDoc = {};
        updateDoc['name'] = req.fields.name;
	updateDoc['borough'] = req.fields.borough;
	updateDoc['cuisine'] = req.fields.cuisine;
	updateDoc['score'] = req.fields.score;

        if (req.files.filetoupload.size > 0) {
            fs.readFile(req.files.filetoupload.path, (err,data) => {
                assert.equal(err,null);
                updateDoc['photo'] = new Buffer.from(data).toString('base64');
                updateDocument(DOCID, updateDoc, (results) => {
                    res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})

                });
            });
        } else {
            updateDocument(DOCID, updateDoc, (results) => {
                res.status(200).render('info', {message: `Updated ${results.result.nModified} document(s)`})

            });
        }
}

const handle_Insert = (req, res) => {

	const client = new MongoClient(mongourl);
    	client.connect((err) => {
        	assert.equal(null, err);
        	console.log("Connected successfully to server");
        	const db = client.db(dbName);

        	var insertDoc ={
				name:req.fields.name, 
				borough:req.fields.borough,
				cuisine:req.fields.cuisine,
				score:req.fields.score,
				owner:currentUser				 			
				};	
		db.collection('restaurants').insertOne(insertDoc, function(err, res) {
 			if (err) throw err;
    			console.log("1 document inserted");
    			client.close();
			 
});		
});
res.status(200).render('info', {message: `Inserted 1 document(s)`})
}

const handle_Delete = (req, res, criteria) => {
	
		const client = new MongoClient(mongourl);
		client.connect((err) => {	  
 	     	assert.equal(null, err);
        	console.log("Connected successfully to server");
        	const db = client.db(dbName);
		db.collection('restaurants').deleteOne({ "_id" : ObjectID(req.fields._id) } );
		client.close();
		});
	res.status(200).render('info', {message: `Removed 1 document(s)`})
}

const handle_Search = (req, res) => {
	
	const client = new MongoClient(mongourl);
	client.connect((err) => {	  
      	assert.equal(null, err);
       	console.log("Connected successfully to server");
       	const db = client.db(dbName);

	var searchText = req.fields.text;
	var result = "";
	var searchOption = req.fields.option;
		
	if (searchOption == `name`){
		var result = db.collection('restaurants').find({ "restaurants.name" : {$eq : searchText }}) 
		var resultJSON = JSON.stringify(result); 	
		res.status(200).render('info', {message: resultJSON})
		
	} else if (searchOption == `borough`){
		db.collection('restaurants').find({ borough : searchText }).toArray(function(err, docs){   	
		res.status(200).render('info', {message: JSON.stringify(docs)})
		});
	} else if (searchOption == `cuisine`){
		db.collection('restaurants').find({ cuisine : searchText }).toArray(function(err, docs){   	
		res.status(200).render('info', {message: JSON.stringify(docs)})
		});
	} 
client.close();	
});
}

app.get('/enter', (req,res) => {
    res.status(200).render('insert',{});
})

app.post('/insert', (req,res) => {
    handle_Insert(req, res, req.query);
})

app.get('/find', (req,res) => {
    handle_Find(res, req.query.docs);
})

app.post('/search', (req,res) => {
    handle_Search(req, res);
})

app.get('/details', (req,res) => {
    handle_Details(res, req.query);
})

app.post('/delete', (req,res) => {
    handle_Delete(req, res, req.query);
})

app.get('/edit', (req,res) => {
    handle_Edit(res, req.query);
})

app.post('/update', (req,res) => {
    handle_Update(req, res, req.query);
})

app.get('/*', (req,res) => {
    res.status(404).render('info', {message: `${req.path} - Unknown request!` });
})

app.get('/api/restaurant/:name', (req,res) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        let criteria = {}
        criteria.name = req.params.name	
        findDocument(db, criteria, (docs) => {
            client.close();
            console.log("Closed DB connection");
            res.status(200).json(docs)
        });
    });
})

module.exports = app
