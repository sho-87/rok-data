// Initial page setup
const meta = {
  'Legend Rhony': {
    file: 'legend_rhony.csv',
    web: 'https://www.youtube.com/channel/UCDKUIl7MVHNTjZgDRPDUdxw',
    strength: -3000,
    distance: 500,
    radius: 1.5
  },
  detectiveG: {
    file: 'detectiveG.csv',
    web:
      'https://docs.google.com/spreadsheets/d/1YqsYjNAxzHHODfzJoPhN3kzyG9xwGvK7NmoK1e3ADdk',
    strength: -1500,
    distance: 500,
    radius: 2
  }
};

const options = Object.keys(meta);

const select = document.getElementById('dropdown');

for (let i = 0; i < options.length; i++) {
  opt = document.createElement('option');
  opt.textContent = options[i];
  select.appendChild(opt);
}

changeData();

// Functions for graph generation
function changeData() {
  selection = document.getElementById('dropdown').value;

  a = document.getElementById('link');
  a.href = meta[selection].web;

  loadGraph(
    meta[selection].file,
    meta[selection].strength,
    meta[selection].distance,
    meta[selection].radius
  );
}

function loadGraph(file, strength, distance, radius) {
  const svg = d3.select('svg'),
    width = +svg.attr('width'),
    height = +svg.attr('height');

  svg.selectAll('*').remove();

  const zoom = d3
    .zoom()
    .scaleExtent([-8 / 2, 4])
    .on('zoom', zoomed);

  svg.call(zoom);

  const g = svg.append('g');

  const color = d3
    .scaleOrdinal()
    .domain(['Legendary', 'Epic', 'Elite', 'Advanced'])
    .range(['#ff9b00', '#ac41c2', '#058cc3', '#2d9830']);

  const tooltip = d3.select('#info').attr('class', 'tooltip');

  const simulation = d3
    .forceSimulation()
    .force('link', d3.forceLink().id(d => d.id))
    .force(
      'charge',
      d3
        .forceManyBody()
        .strength(strength)
        .distanceMax([distance])
    )
    .force('center', d3.forceCenter(width / 2, height / 2));

  // Read data from files
  d3.queue()
    .defer(d3.json, 'commanders.json')
    .defer(d3.csv, `links/${file}`)
    .await(function(error, commanders, links) {
      if (error) {
        console.error(error);
      } else {
        links = links.map(d => ({
          source: d.primary,
          target: d.secondary,
          rank: d.rank
        }));

        // calculate node weights (number of links)
        commanders.nodes.forEach(n => {
          n.weight = (function() {
            let weight = 0;
            links.forEach(l => {
              if ((n.id === l.source) | (n.id === l.target)) {
                weight++;
              }
            });
            return weight;
          })();
        });

        // links
        const link = g
          .attr('class', 'links')
          .selectAll('line')
          .data(links)
          .enter()
          .append('line')
          .attr('stroke-width', d => (1/d.rank) * 2);

        // nodes
        const node = g
          .selectAll('.node')
          .data(commanders.nodes)
          .enter()
          .append('g')
          .attr('class', 'nodes')
          .filter(d => {
            if (d.weight != 0) {
              return this;
            }
          })
          .call(
            d3
              .drag()
              .on('start', dragstarted)
              .on('drag', dragged)
              .on('end', dragended)
          );

        node
          .append('circle')
          .attr('r', d => d.weight * radius)
          .attr('fill', d => color(d.group))
          .on('mouseover.tooltip', function(d) {
            // Generate tooltip text
            info = `<strong>${d.id}</strong><br/><span class=${d.group}>${
              d.group
            }</span><br>Versatility (# of pairs): ${d.weight}`;

            table = `<p><table id='tooltipTable' border=1>
                        <tr style="font-weight:bold">
                          <td class='primary'>Primary</td>
                          <td class='secondary'>Secondary</td>
                          <td>Rank</td>
                        </tr>`;

            rank_sum = 0;
            links.forEach(pair => {
              if (d.id === pair.source.id) {
                rank_sum += Number(pair.rank);
                table += `<tr><td style='font-weight:bold'>${
                  pair.source.id
                }</td><td>${pair.target.id}</td><td>${pair.rank}</td></tr>`;
              } else if (d.id === pair.target.id) {
                rank_sum += Number(pair.rank);
                table += `<tr><td>${
                  pair.source.id
                }</td><td style='font-weight:bold'>${pair.target.id}</td><td>${
                  pair.rank
                }</td></tr>`;
              }
            });
            table += '</table>';

            info_rank = `<br>Mean rank: ${(rank_sum / d.weight).toFixed(2)}`;

            tooltip
              .transition()
              .duration(300)
              .style('opacity', 1);
            tooltip.html(info + info_rank + table);

            sortTable();
          })
          .on('mouseout.tooltip', function() {
            tooltip
              .transition()
              .duration(100)
              .style('opacity', 0);
          })
          .on('mouseover.fade', fade(0.1))
          .on('mouseout.fade', fade(1));

        // node labels
        node
          .append('text')
          .text(d => d.id)
          .attr('x', 0)
          .attr('y', 0);

        simulation.nodes(commanders.nodes).on('tick', ticked);
        simulation.force('link').links(links);

        function ticked() {
          // zoom to bounding box of nodes
          if (this.alpha() > 0.04) {
            // set up zoom transform:
            var xExtent = d3.extent(node.data(), function(d) {
              return d.x + 100;
            });
            var yExtent = d3.extent(node.data(), function(d) {
              return d.y;
            });

            // get scales:
            var xScale = (width / (xExtent[1] - xExtent[0])) * 0.75;
            var yScale = (height / (yExtent[1] - yExtent[0])) * 0.75;

            // get most restrictive scale
            var minScale = Math.min(xScale, yScale);

            if (minScale < 1) {
              var transform = d3.zoomIdentity
                .translate(width / 2, height / 2)
                .scale(minScale)
                .translate(
                  -(xExtent[0] + xExtent[1]) / 2,
                  -(yExtent[0] + yExtent[1]) / 2
                );
              svg.call(zoom.transform, transform);
            }
          } else {
            svg.attr('cursor', 'pointer');
            var check = false;
          }

          link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

          node.attr('transform', d => `translate(${d.x},${d.y})`);
        }

        const linkedByIndex = {};
        links.forEach(d => {
          linkedByIndex[`${d.source.index},${d.target.index}`] = 1;
        });

        function isConnected(a, b) {
          return (
            linkedByIndex[`${a.index},${b.index}`] ||
            linkedByIndex[`${b.index},${a.index}`] ||
            a.index === b.index
          );
        }

        function fade(opacity) {
          return d => {
            node.style('stroke-opacity', function(o) {
              const thisOpacity = isConnected(d, o) ? 1 : opacity;
              this.setAttribute('fill-opacity', thisOpacity);
              return thisOpacity;
            });

            link.style('stroke-opacity', o =>
              o.source === d || o.target === d ? 1 : opacity
            );
          };
        }

        function sortTable() {
          var table, rows, switching, i, x, y, shouldSwitch;
          table = document.getElementById('tooltipTable');
          switching = true;

          while (switching) {
            switching = false;
            rows = table.rows;

            for (i = 1; i < rows.length - 1; i++) {
              shouldSwitch = false;

              x = rows[i].getElementsByTagName('TD')[2];
              y = rows[i + 1].getElementsByTagName('TD')[2];

              if (Number(x.innerHTML) > Number(y.innerHTML)) {
                shouldSwitch = true;
                break;
              }
            }
            if (shouldSwitch) {
              rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
              switching = true;
            }
          }
        }
      }
    });

  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function zoomed() {
    g.attr('transform', d3.event.transform);
  }
}
