
SRCS != echo *.html *.js

all: www.tgz

www.tgz: ${SRCS}
	tar cvzf $@ ${SRCS}

publish: www.tgz
	ssh server tar xzvf - -C /var/www/htdocs/stuerz.xyz/man/ < www.tgz

