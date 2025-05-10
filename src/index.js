const instance_key = 'current_instance';
const instance_pattern = /<td align="left"><a href="https:\/\/([^\/"]+)\/?" rel="nofollow">[^<]+<\/a><\/td>\n<td align="left">✅<\/td>\n<td align="left">✅<\/td>/g;

export default {
    async fetch(request, env) {
        let url = new URL(request.url);
        let url_hostname = url.hostname;

        url.host = await get_current_instance(env);

        let method = request.method;
        let body = request.body;
        let headers = replace_headers(request.headers, url_hostname, url.host);

        headers.delete('Content-Length');

        try {
            let original_response = await fetch(url.href, { method, headers, body });
            return handle_response(original_response, env);
        } catch {
            await update_current_instance(env);
            return Response.redirect(url.href);
        }
    }
}

async function handle_response(original_response, env) {
    let connection_upgrade = headers.get("Upgrade");
    if (connection_upgrade && connection_upgrade.toLowerCase() == "websocket") {
        return original_response;
    }

    let status = original_response.status;
    if (status != 200 && status != 404) {
        await update_current_instance(env);
        return Response.redirect(url.href);
    }

    let headers = replace_headers(original_response.headers, url.host, url_hostname);
    let body = original_response.body;

    headers.set('access-control-allow-origin', '*');
    headers.set('access-control-allow-credentials', true);
    headers.delete('content-security-policy');
    headers.delete('content-security-policy-report-only');
    headers.delete('clear-site-data');

    return new Response(body, { status, headers });
}

function replace_headers(headers, before, after) {
    let new_headers = new Headers();
    let pattern = new RegExp('https?\\://' + before.replaceAll('.', '\\.'), 'g');

    headers.forEach((value, key) => {
        let new_value = value;
        new_value = new_value.replace(pattern, 'https://' + after);
        new_value = new_value.replaceAll(before, after);
        new_headers.append(key, new_value);
    });

    return new_headers;
}

async function get_current_instance(env) {
    let instance = await env.NITTER_KV_NAMESPACE.get(instance_key);

    if (!instance) {
        instance = await update_current_instance(env);
    }

    return instance;
}

async function update_current_instance(env) {
    let response = await fetch('https://github.com/zedeus/nitter/wiki/Instances');
    let response_text = await response.text();
    let instances = [];

  for (let instance of response_text.matchAll(instance_pattern)) {
    if (instance && instance[1]) {
      instances.push(instance[1]);
    }
  }

  let instance_value = instances[Math.floor(Math.random() * instances.length)];
  await env.NITTER_KV_NAMESPACE.put(instance_key, instance_value, {
            expirationTtl: 3600,
        });
    }

    return instance_value;
}
