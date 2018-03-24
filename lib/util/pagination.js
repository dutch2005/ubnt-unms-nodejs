'use strict';

const { ceil, floor, min } = require('lodash/fp');


function toBackendPagination(pageSize = 50, page = 1) {
  const offset = (page - 1) * pageSize;
  return { offset, limit: pageSize };
}


function toApiPagination(offset = 0, limit = 50, total = 50) {
  const pages = ceil(total / limit);
  const page = floor(offset / limit) + 1;
  const safeCurrentPage = min([page, pages]);

  return { pageSize: limit, page: safeCurrentPage, pages, total };
}

function toBackendPaginationPrerequisite() {
  return {
    method(request, reply) {
      const { count, page } = request.query;

      reply(toBackendPagination(count, page));
    },
    assign: 'pagination',
  };
}


module.exports = {
  toBackendPagination,
  toApiPagination,

  toBackendPaginationPrerequisite,
};
