const { createClient } = require('@libsql/client');
const client = createClient({ url: "file:./test.db" });

async function run() {
    try {
        console.log("Testing LibSQL...");
        const rs = await client.execute("SELECT 1 as test");
        console.log("Success:", rs.rows[0].test);
    } catch (err) {
        console.error("Failure:", err);
    }
}
run();
